"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { db } from "@/lib/db"
import { getAuthSession } from "@/lib/auth-helpers"
import type { ActionResult } from "@/lib/types"
import type { LeagueStatus } from "@/generated/prisma/client"

const LeagueSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich").max(100, "Name zu lang"),
  disciplineId: z.string().min(1, "Disziplin ist erforderlich"),
  firstLegDeadline: z.string().nullable().optional(),
  secondLegDeadline: z.string().nullable().optional(),
})

function parseDeadline(value: string | null | undefined): Date | null {
  if (!value || value.trim() === "") return null
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : d
}

function revalidateLeaguePaths(): void {
  revalidatePath("/leagues")
  revalidatePath("/leagues", "layout")
}

// ─────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────

export async function createLeague(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet" }
  if (session.user.role !== "ADMIN") return { error: "Keine Berechtigung" }

  const parsed = LeagueSchema.safeParse({
    name: formData.get("name"),
    disciplineId: formData.get("disciplineId"),
    firstLegDeadline: formData.get("firstLegDeadline"),
    secondLegDeadline: formData.get("secondLegDeadline"),
  })
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const discipline = await db.discipline.findUnique({
    where: { id: parsed.data.disciplineId },
    select: { id: true },
  })
  if (!discipline) return { error: "Disziplin nicht gefunden." }

  await db.league.create({
    data: {
      name: parsed.data.name,
      disciplineId: parsed.data.disciplineId,
      firstLegDeadline: parseDeadline(parsed.data.firstLegDeadline),
      secondLegDeadline: parseDeadline(parsed.data.secondLegDeadline),
      createdByUserId: session.user.id,
    },
  })

  revalidateLeaguePaths()
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────────────────────

export async function updateLeague(
  id: string,
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet" }
  if (session.user.role !== "ADMIN") return { error: "Keine Berechtigung" }

  const league = await db.league.findUnique({ where: { id }, select: { id: true } })
  if (!league) return { error: "Liga nicht gefunden." }

  const UpdateSchema = z.object({
    name: z.string().min(1, "Name ist erforderlich").max(100, "Name zu lang"),
    firstLegDeadline: z.string().nullable().optional(),
    secondLegDeadline: z.string().nullable().optional(),
  })

  const parsed = UpdateSchema.safeParse({
    name: formData.get("name"),
    firstLegDeadline: formData.get("firstLegDeadline"),
    secondLegDeadline: formData.get("secondLegDeadline"),
  })
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  await db.league.update({
    where: { id },
    data: {
      name: parsed.data.name,
      firstLegDeadline: parseDeadline(parsed.data.firstLegDeadline),
      secondLegDeadline: parseDeadline(parsed.data.secondLegDeadline),
    },
  })

  revalidateLeaguePaths()
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// STATUS
// ─────────────────────────────────────────────────────────────

/** Erlaubte Statusübergänge (bidirektional) */
const ALLOWED_TRANSITIONS: Record<LeagueStatus, LeagueStatus[]> = {
  ACTIVE: ["COMPLETED"],
  COMPLETED: ["ARCHIVED", "ACTIVE"],
  ARCHIVED: ["COMPLETED"],
}

export async function setLeagueStatus(id: string, status: LeagueStatus): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet" }
  if (session.user.role !== "ADMIN") return { error: "Keine Berechtigung" }

  const league = await db.league.findUnique({ where: { id }, select: { id: true, status: true } })
  if (!league) return { error: "Liga nicht gefunden." }

  if (!ALLOWED_TRANSITIONS[league.status].includes(status)) {
    return {
      error: `Statuswechsel von ${league.status} nach ${status} ist nicht erlaubt.`,
    }
  }

  await db.league.update({ where: { id }, data: { status } })
  revalidateLeaguePaths()
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────────────────────

/** Löschen nur ohne abhängige Daten (Teilnehmer, Paarungen, Playoffs). */
export async function deleteLeague(id: string): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet" }
  if (session.user.role !== "ADMIN") return { error: "Keine Berechtigung" }

  const league = await db.league.findUnique({ where: { id }, select: { id: true } })
  if (!league) return { error: "Liga nicht gefunden." }

  const [participantCount, matchupCount, playoffCount] = await Promise.all([
    db.leagueParticipant.count({ where: { leagueId: id } }),
    db.matchup.count({ where: { leagueId: id } }),
    db.playoffMatch.count({ where: { leagueId: id } }),
  ])

  if (participantCount > 0 || matchupCount > 0 || playoffCount > 0) {
    return {
      error:
        "Liga kann nicht gelöscht werden — es sind bereits Daten verknüpft. Bitte archivieren.",
    }
  }

  await db.league.delete({ where: { id } })
  revalidateLeaguePaths()
  return { success: true }
}

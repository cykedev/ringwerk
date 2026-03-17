"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { db } from "@/lib/db"
import { getAuthSession } from "@/lib/auth-helpers"
import type { ActionResult } from "@/lib/types"
import type { CompetitionStatus } from "@/generated/prisma/client"

const CompetitionSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich").max(100, "Name zu lang"),
  disciplineId: z.string().min(1, "Disziplin ist erforderlich"),
  hinrundeDeadline: z.string().nullable().optional(),
  rueckrundeDeadline: z.string().nullable().optional(),
})

function parseDeadline(value: string | null | undefined): Date | null {
  if (!value || value.trim() === "") return null
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : d
}

function revalidateCompetitionPaths(): void {
  revalidatePath("/competitions")
  revalidatePath("/competitions", "layout")
}

// ─────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────

export async function createCompetition(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet" }
  if (session.user.role !== "ADMIN") return { error: "Keine Berechtigung" }

  const parsed = CompetitionSchema.safeParse({
    name: formData.get("name"),
    disciplineId: formData.get("disciplineId"),
    hinrundeDeadline: formData.get("hinrundeDeadline"),
    rueckrundeDeadline: formData.get("rueckrundeDeadline"),
  })
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const discipline = await db.discipline.findUnique({
    where: { id: parsed.data.disciplineId },
    select: { id: true },
  })
  if (!discipline) return { error: "Disziplin nicht gefunden." }

  await db.competition.create({
    data: {
      name: parsed.data.name,
      disciplineId: parsed.data.disciplineId,
      hinrundeDeadline: parseDeadline(parsed.data.hinrundeDeadline),
      rueckrundeDeadline: parseDeadline(parsed.data.rueckrundeDeadline),
      createdByUserId: session.user.id,
    },
  })

  revalidateCompetitionPaths()
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────────────────────

export async function updateCompetition(
  id: string,
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet" }
  if (session.user.role !== "ADMIN") return { error: "Keine Berechtigung" }

  const competition = await db.competition.findUnique({ where: { id }, select: { id: true } })
  if (!competition) return { error: "Wettbewerb nicht gefunden." }

  const UpdateSchema = z.object({
    name: z.string().min(1, "Name ist erforderlich").max(100, "Name zu lang"),
    hinrundeDeadline: z.string().nullable().optional(),
    rueckrundeDeadline: z.string().nullable().optional(),
  })

  const parsed = UpdateSchema.safeParse({
    name: formData.get("name"),
    hinrundeDeadline: formData.get("hinrundeDeadline"),
    rueckrundeDeadline: formData.get("rueckrundeDeadline"),
  })
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  await db.competition.update({
    where: { id },
    data: {
      name: parsed.data.name,
      hinrundeDeadline: parseDeadline(parsed.data.hinrundeDeadline),
      rueckrundeDeadline: parseDeadline(parsed.data.rueckrundeDeadline),
    },
  })

  revalidateCompetitionPaths()
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// STATUS
// ─────────────────────────────────────────────────────────────

/** Erlaubte Statusübergänge */
const ALLOWED_TRANSITIONS: Record<CompetitionStatus, CompetitionStatus[]> = {
  DRAFT: ["ACTIVE"],
  ACTIVE: ["COMPLETED"],
  COMPLETED: ["ARCHIVED", "ACTIVE"],
  ARCHIVED: ["COMPLETED"],
}

export async function setCompetitionStatus(
  id: string,
  status: CompetitionStatus
): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet" }
  if (session.user.role !== "ADMIN") return { error: "Keine Berechtigung" }

  const competition = await db.competition.findUnique({
    where: { id },
    select: { id: true, status: true },
  })
  if (!competition) return { error: "Wettbewerb nicht gefunden." }

  if (!ALLOWED_TRANSITIONS[competition.status].includes(status)) {
    return {
      error: `Statuswechsel von ${competition.status} nach ${status} ist nicht erlaubt.`,
    }
  }

  await db.competition.update({ where: { id }, data: { status } })
  revalidateCompetitionPaths()
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────────────────────

/** Löschen nur ohne abhängige Daten (Teilnehmer, Paarungen, Playoffs). */
export async function deleteCompetition(id: string): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet" }
  if (session.user.role !== "ADMIN") return { error: "Keine Berechtigung" }

  const competition = await db.competition.findUnique({ where: { id }, select: { id: true } })
  if (!competition) return { error: "Wettbewerb nicht gefunden." }

  const [participantCount, matchupCount, playoffCount] = await Promise.all([
    db.competitionParticipant.count({ where: { competitionId: id } }),
    db.matchup.count({ where: { competitionId: id } }),
    db.playoffMatch.count({ where: { competitionId: id } }),
  ])

  if (participantCount > 0 || matchupCount > 0 || playoffCount > 0) {
    return {
      error:
        "Wettbewerb kann nicht gelöscht werden — es sind bereits Daten verknüpft. Bitte archivieren.",
    }
  }

  await db.competition.delete({ where: { id } })
  revalidateCompetitionPaths()
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// FORCE DELETE (mit allen Abhängigkeiten)
// ─────────────────────────────────────────────────────────────

/** Endgültiges Löschen eines Wettbewerbs inkl. aller abhängigen Daten. */
export async function forceDeleteCompetition(
  competitionId: string,
  confirmationName: string
): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet" }
  if (session.user.role !== "ADMIN") return { error: "Keine Berechtigung" }

  const competition = await db.competition.findUnique({
    where: { id: competitionId },
    select: { id: true, name: true },
  })
  if (!competition) return { error: "Wettbewerb nicht gefunden." }

  if (confirmationName.trim() !== competition.name) {
    return { error: "Der eingegebene Name stimmt nicht mit dem Wettbewerb-Namen überein." }
  }

  try {
    await db.$transaction(async (tx) => {
      // 1. IDs sammeln für Bottom-up-Löschung
      const matchups = await tx.matchup.findMany({
        where: { competitionId },
        select: { id: true },
      })
      const matchupIds = matchups.map((m) => m.id)

      const playoffMatches = await tx.playoffMatch.findMany({
        where: { competitionId },
        select: { id: true },
      })
      const playoffMatchIds = playoffMatches.map((pm) => pm.id)

      // 2. Bottom-up löschen
      if (playoffMatchIds.length > 0) {
        const playoffDuels = await tx.playoffDuel.findMany({
          where: { playoffMatchId: { in: playoffMatchIds } },
          select: { id: true },
        })
        const playoffDuelIds = playoffDuels.map((pd) => pd.id)

        if (playoffDuelIds.length > 0) {
          await tx.playoffDuelResult.deleteMany({
            where: { duelId: { in: playoffDuelIds } },
          })
          await tx.playoffDuel.deleteMany({
            where: { id: { in: playoffDuelIds } },
          })
        }

        await tx.playoffMatch.deleteMany({
          where: { id: { in: playoffMatchIds } },
        })
      }

      if (matchupIds.length > 0) {
        await tx.series.deleteMany({
          where: { matchupId: { in: matchupIds } },
        })
      }

      await tx.matchup.deleteMany({ where: { competitionId } })

      // AuditLog-Einträge bereinigen
      await tx.auditLog.deleteMany({ where: { competitionId } })

      await tx.competitionParticipant.deleteMany({ where: { competitionId } })
      await tx.competition.delete({ where: { id: competitionId } })
    })
  } catch (error) {
    console.error("Fehler beim endgültigen Löschen des Wettbewerbs:", error)
    return { error: "Wettbewerb konnte nicht gelöscht werden." }
  }

  revalidateCompetitionPaths()
  return { success: true }
}

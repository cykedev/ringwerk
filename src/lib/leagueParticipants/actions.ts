"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { db } from "@/lib/db"
import { getAuthSession } from "@/lib/auth-helpers"
import type { ActionResult } from "@/lib/types"

function revalidateLeagueParticipantPaths(leagueId: string): void {
  revalidatePath(`/leagues/${leagueId}/participants`)
  revalidatePath("/leagues")
}

// ─────────────────────────────────────────────────────────────
// ENROLL
// ─────────────────────────────────────────────────────────────

const EnrollSchema = z.object({
  participantId: z.string().min(1, "Teilnehmer ist erforderlich"),
  startNumber: z
    .string()
    .nullable()
    .optional()
    .transform((v) => {
      if (!v || v.trim() === "") return null
      const n = parseInt(v, 10)
      return isNaN(n) ? null : n
    }),
})

export async function enrollParticipant(
  leagueId: string,
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet" }
  if (session.user.role !== "ADMIN") return { error: "Keine Berechtigung" }

  const league = await db.league.findUnique({
    where: { id: leagueId },
    select: { id: true, status: true },
  })
  if (!league) return { error: "Liga nicht gefunden." }
  if (league.status !== "ACTIVE") {
    return { error: "Teilnehmer können nur in aktive Ligen eingeschrieben werden." }
  }

  const parsed = EnrollSchema.safeParse({
    participantId: formData.get("participantId"),
    startNumber: formData.get("startNumber"),
  })
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const existing = await db.leagueParticipant.findUnique({
    where: {
      leagueId_participantId: { leagueId, participantId: parsed.data.participantId },
    },
    select: { id: true },
  })
  if (existing) return { error: "Teilnehmer ist bereits in dieser Liga eingeschrieben." }

  await db.leagueParticipant.create({
    data: {
      leagueId,
      participantId: parsed.data.participantId,
      startNumber: parsed.data.startNumber,
    },
  })

  revalidateLeagueParticipantPaths(leagueId)
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// UNENROLL
// ─────────────────────────────────────────────────────────────

export async function unenrollParticipant(leagueParticipantId: string): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet" }
  if (session.user.role !== "ADMIN") return { error: "Keine Berechtigung" }

  const lp = await db.leagueParticipant.findUnique({
    where: { id: leagueParticipantId },
    select: { id: true, leagueId: true, participantId: true },
  })
  if (!lp) return { error: "Einschreibung nicht gefunden." }

  const matchupCount = await db.matchup.count({
    where: {
      leagueId: lp.leagueId,
      OR: [{ homeParticipantId: lp.participantId }, { awayParticipantId: lp.participantId }],
    },
  })
  if (matchupCount > 0) {
    return {
      error:
        "Teilnehmer kann nicht entfernt werden — es existieren bereits Paarungen. Bitte Rückzug verwenden.",
    }
  }

  await db.leagueParticipant.delete({ where: { id: leagueParticipantId } })
  revalidateLeagueParticipantPaths(lp.leagueId)
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// WITHDRAW
// ─────────────────────────────────────────────────────────────

const WithdrawSchema = z.object({
  reason: z.string().max(500).nullable().optional(),
})

export async function withdrawParticipant(
  leagueParticipantId: string,
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet" }
  if (session.user.role !== "ADMIN") return { error: "Keine Berechtigung" }

  const lp = await db.leagueParticipant.findUnique({
    where: { id: leagueParticipantId },
    select: {
      id: true,
      leagueId: true,
      participantId: true,
      status: true,
      participant: { select: { firstName: true, lastName: true } },
    },
  })
  if (!lp) return { error: "Einschreibung nicht gefunden." }
  if (lp.status === "WITHDRAWN") return { error: "Teilnehmer ist bereits zurückgezogen." }

  const playoffCount = await db.playoffMatch.count({ where: { leagueId: lp.leagueId } })
  if (playoffCount > 0) {
    return { error: "Rückzug nicht möglich — Playoffs haben bereits begonnen." }
  }

  const parsed = WithdrawSchema.safeParse({ reason: formData.get("reason") })
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const now = new Date()

  await db.$transaction([
    db.leagueParticipant.update({
      where: { id: leagueParticipantId },
      data: { status: "WITHDRAWN", withdrawnAt: now },
    }),
    db.auditLog.create({
      data: {
        eventType: "PARTICIPANT_WITHDRAWN",
        entityType: "LEAGUE_PARTICIPANT",
        entityId: leagueParticipantId,
        userId: session.user.id,
        leagueId: lp.leagueId,
        details: {
          participantId: lp.participantId,
          name: `${lp.participant.firstName} ${lp.participant.lastName}`,
          reason: parsed.data.reason ?? null,
          withdrawnAt: now.toISOString(),
        },
      },
    }),
  ])

  revalidateLeagueParticipantPaths(lp.leagueId)
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// REVOKE WITHDRAWAL
// ─────────────────────────────────────────────────────────────

export async function revokeWithdrawal(leagueParticipantId: string): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet" }
  if (session.user.role !== "ADMIN") return { error: "Keine Berechtigung" }

  const lp = await db.leagueParticipant.findUnique({
    where: { id: leagueParticipantId },
    select: {
      id: true,
      leagueId: true,
      participantId: true,
      status: true,
      participant: { select: { firstName: true, lastName: true } },
    },
  })
  if (!lp) return { error: "Einschreibung nicht gefunden." }
  if (lp.status !== "WITHDRAWN") return { error: "Teilnehmer ist nicht zurückgezogen." }

  const playoffCount = await db.playoffMatch.count({ where: { leagueId: lp.leagueId } })
  if (playoffCount > 0) {
    return {
      error: "Rückzug kann nicht rückgängig gemacht werden — Playoffs haben bereits begonnen.",
    }
  }

  await db.$transaction([
    db.leagueParticipant.update({
      where: { id: leagueParticipantId },
      data: { status: "ACTIVE", withdrawnAt: null },
    }),
    db.auditLog.create({
      data: {
        eventType: "WITHDRAWAL_REVOKED",
        entityType: "LEAGUE_PARTICIPANT",
        entityId: leagueParticipantId,
        userId: session.user.id,
        leagueId: lp.leagueId,
        details: {
          participantId: lp.participantId,
          name: `${lp.participant.firstName} ${lp.participant.lastName}`,
        },
      },
    }),
  ])

  revalidateLeagueParticipantPaths(lp.leagueId)
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// UPDATE START NUMBER
// ─────────────────────────────────────────────────────────────

export async function updateStartNumber(
  leagueParticipantId: string,
  startNumber: number | null
): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet" }
  if (session.user.role !== "ADMIN") return { error: "Keine Berechtigung" }

  const lp = await db.leagueParticipant.findUnique({
    where: { id: leagueParticipantId },
    select: { id: true, leagueId: true },
  })
  if (!lp) return { error: "Einschreibung nicht gefunden." }

  await db.leagueParticipant.update({
    where: { id: leagueParticipantId },
    data: { startNumber },
  })

  revalidateLeagueParticipantPaths(lp.leagueId)
  return { success: true }
}

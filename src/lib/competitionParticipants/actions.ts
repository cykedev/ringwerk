"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { db } from "@/lib/db"
import { getAuthSession } from "@/lib/auth-helpers"
import type { ActionResult } from "@/lib/types"

function revalidateCompetitionParticipantPaths(competitionId: string): void {
  revalidatePath(`/competitions/${competitionId}/participants`)
  revalidatePath("/competitions")
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
  competitionId: string,
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet" }
  if (session.user.role !== "ADMIN") return { error: "Keine Berechtigung" }

  const competition = await db.competition.findUnique({
    where: { id: competitionId },
    select: { id: true, status: true },
  })
  if (!competition) return { error: "Wettbewerb nicht gefunden." }
  if (competition.status !== "ACTIVE") {
    return { error: "Teilnehmer können nur in aktive Wettbewerbe eingeschrieben werden." }
  }

  const parsed = EnrollSchema.safeParse({
    participantId: formData.get("participantId"),
    startNumber: formData.get("startNumber"),
  })
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const existing = await db.competitionParticipant.findUnique({
    where: {
      competitionId_participantId: {
        competitionId,
        participantId: parsed.data.participantId,
      },
    },
    select: { id: true },
  })
  if (existing) return { error: "Teilnehmer ist bereits in diesem Wettbewerb eingeschrieben." }

  await db.competitionParticipant.create({
    data: {
      competitionId,
      participantId: parsed.data.participantId,
      startNumber: parsed.data.startNumber,
    },
  })

  revalidateCompetitionParticipantPaths(competitionId)
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// UNENROLL
// ─────────────────────────────────────────────────────────────

export async function unenrollParticipant(competitionParticipantId: string): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet" }
  if (session.user.role !== "ADMIN") return { error: "Keine Berechtigung" }

  const cp = await db.competitionParticipant.findUnique({
    where: { id: competitionParticipantId },
    select: { id: true, competitionId: true, participantId: true },
  })
  if (!cp) return { error: "Einschreibung nicht gefunden." }

  const matchupCount = await db.matchup.count({
    where: {
      competitionId: cp.competitionId,
      OR: [{ homeParticipantId: cp.participantId }, { awayParticipantId: cp.participantId }],
    },
  })
  if (matchupCount > 0) {
    return {
      error:
        "Teilnehmer kann nicht entfernt werden — es existieren bereits Paarungen. Bitte Rückzug verwenden.",
    }
  }

  await db.competitionParticipant.delete({ where: { id: competitionParticipantId } })
  revalidateCompetitionParticipantPaths(cp.competitionId)
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// WITHDRAW
// ─────────────────────────────────────────────────────────────

const WithdrawSchema = z.object({
  reason: z.string().max(500).nullable().optional(),
})

export async function withdrawParticipant(
  competitionParticipantId: string,
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet" }
  if (session.user.role !== "ADMIN") return { error: "Keine Berechtigung" }

  const cp = await db.competitionParticipant.findUnique({
    where: { id: competitionParticipantId },
    select: {
      id: true,
      competitionId: true,
      participantId: true,
      status: true,
      participant: { select: { firstName: true, lastName: true } },
    },
  })
  if (!cp) return { error: "Einschreibung nicht gefunden." }
  if (cp.status === "WITHDRAWN") return { error: "Teilnehmer ist bereits zurückgezogen." }

  const playoffCount = await db.playoffMatch.count({ where: { competitionId: cp.competitionId } })
  if (playoffCount > 0) {
    return { error: "Rückzug nicht möglich — Playoffs haben bereits begonnen." }
  }

  const parsed = WithdrawSchema.safeParse({ reason: formData.get("reason") })
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const now = new Date()

  await db.$transaction([
    db.competitionParticipant.update({
      where: { id: competitionParticipantId },
      data: { status: "WITHDRAWN", withdrawnAt: now },
    }),
    db.auditLog.create({
      data: {
        eventType: "PARTICIPANT_WITHDRAWN",
        entityType: "COMPETITION_PARTICIPANT",
        entityId: competitionParticipantId,
        userId: session.user.id,
        competitionId: cp.competitionId,
        details: {
          participantId: cp.participantId,
          name: `${cp.participant.firstName} ${cp.participant.lastName}`,
          reason: parsed.data.reason ?? null,
          withdrawnAt: now.toISOString(),
        },
      },
    }),
  ])

  revalidateCompetitionParticipantPaths(cp.competitionId)
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// REVOKE WITHDRAWAL
// ─────────────────────────────────────────────────────────────

export async function revokeWithdrawal(competitionParticipantId: string): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet" }
  if (session.user.role !== "ADMIN") return { error: "Keine Berechtigung" }

  const cp = await db.competitionParticipant.findUnique({
    where: { id: competitionParticipantId },
    select: {
      id: true,
      competitionId: true,
      participantId: true,
      status: true,
      participant: { select: { firstName: true, lastName: true } },
    },
  })
  if (!cp) return { error: "Einschreibung nicht gefunden." }
  if (cp.status !== "WITHDRAWN") return { error: "Teilnehmer ist nicht zurückgezogen." }

  const playoffCount = await db.playoffMatch.count({ where: { competitionId: cp.competitionId } })
  if (playoffCount > 0) {
    return {
      error: "Rückzug kann nicht rückgängig gemacht werden — Playoffs haben bereits begonnen.",
    }
  }

  await db.$transaction([
    db.competitionParticipant.update({
      where: { id: competitionParticipantId },
      data: { status: "ACTIVE", withdrawnAt: null },
    }),
    db.auditLog.create({
      data: {
        eventType: "WITHDRAWAL_REVOKED",
        entityType: "COMPETITION_PARTICIPANT",
        entityId: competitionParticipantId,
        userId: session.user.id,
        competitionId: cp.competitionId,
        details: {
          participantId: cp.participantId,
          name: `${cp.participant.firstName} ${cp.participant.lastName}`,
        },
      },
    }),
  ])

  revalidateCompetitionParticipantPaths(cp.competitionId)
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// UPDATE START NUMBER
// ─────────────────────────────────────────────────────────────

export async function updateStartNumber(
  competitionParticipantId: string,
  startNumber: number | null
): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet" }
  if (session.user.role !== "ADMIN") return { error: "Keine Berechtigung" }

  const cp = await db.competitionParticipant.findUnique({
    where: { id: competitionParticipantId },
    select: { id: true, competitionId: true },
  })
  if (!cp) return { error: "Einschreibung nicht gefunden." }

  await db.competitionParticipant.update({
    where: { id: competitionParticipantId },
    data: { startNumber },
  })

  revalidateCompetitionParticipantPaths(cp.competitionId)
  return { success: true }
}

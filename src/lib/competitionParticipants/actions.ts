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

const EnrollSchema = z
  .object({
    participantId: z
      .string()
      .nullable()
      .optional()
      .transform((v) => v || null),
    guestName: z
      .string()
      .nullable()
      .optional()
      .transform((v) => v?.trim() || null),
    startNumber: z
      .string()
      .nullable()
      .optional()
      .transform((v) => {
        if (!v || v.trim() === "") return null
        const n = parseInt(v, 10)
        return isNaN(n) ? null : n
      }),
    isGuest: z
      .string()
      .nullable()
      .optional()
      .transform((v) => v === "true" || v === "on"),
    disciplineId: z
      .string()
      .nullable()
      .optional()
      .transform((v) => v || null),
  })
  .superRefine((data, ctx) => {
    if (data.isGuest) {
      if (!data.guestName) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Gastname ist erforderlich",
          path: ["guestName"],
        })
      }
    } else {
      if (!data.participantId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Teilnehmer ist erforderlich",
          path: ["participantId"],
        })
      }
    }
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
    select: { id: true, status: true, disciplineId: true },
  })
  if (!competition) return { error: "Wettbewerb nicht gefunden." }
  if (competition.status !== "ACTIVE") {
    return { error: "Teilnehmer können nur in aktive Wettbewerbe eingeschrieben werden." }
  }

  const parsed = EnrollSchema.safeParse({
    participantId: formData.get("participantId"),
    guestName: formData.get("guestName"),
    startNumber: formData.get("startNumber"),
    isGuest: formData.get("isGuest"),
    disciplineId: formData.get("disciplineId"),
  })
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  // Bei gemischtem Wettbewerb (disciplineId = null) muss Disziplin gewählt werden
  if (!competition.disciplineId && !parsed.data.disciplineId) {
    return { error: "Bei gemischten Wettbewerben muss eine Disziplin gewählt werden." }
  }

  if (parsed.data.isGuest) {
    // Gast-Pfad: stiller Participant-Record + Einschreibung in einer Transaktion
    await db.$transaction(async (tx) => {
      const guestParticipant = await tx.participant.create({
        data: {
          firstName: parsed.data.guestName!,
          lastName: "",
          contact: null,
          isActive: true,
          isGuestRecord: true,
          createdByUserId: session.user.id,
        },
      })
      await tx.competitionParticipant.create({
        data: {
          competitionId,
          participantId: guestParticipant.id,
          startNumber: parsed.data.startNumber,
          isGuest: true,
          disciplineId: parsed.data.disciplineId,
        },
      })
    })
  } else {
    const existing = await db.competitionParticipant.findUnique({
      where: {
        competitionId_participantId: {
          competitionId,
          participantId: parsed.data.participantId!,
        },
      },
      select: { id: true },
    })
    if (existing) return { error: "Teilnehmer ist bereits in diesem Wettbewerb eingeschrieben." }

    await db.competitionParticipant.create({
      data: {
        competitionId,
        participantId: parsed.data.participantId!,
        startNumber: parsed.data.startNumber,
        isGuest: false,
        disciplineId: parsed.data.disciplineId,
      },
    })
  }

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
    select: {
      id: true,
      competitionId: true,
      participantId: true,
      isGuest: true,
    },
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

  if (cp.isGuest) {
    // Gast: Serien + Einschreibung + stiller Participant-Record löschen
    await db.$transaction(async (tx) => {
      await tx.series.deleteMany({
        where: { participantId: cp.participantId, competitionId: cp.competitionId },
      })
      await tx.competitionParticipant.delete({ where: { id: competitionParticipantId } })
      await tx.participant.delete({ where: { id: cp.participantId } })
    })
  } else {
    await db.competitionParticipant.delete({ where: { id: competitionParticipantId } })
  }

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
          name: [cp.participant.firstName, cp.participant.lastName].filter(Boolean).join(" "),
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
          name: [cp.participant.firstName, cp.participant.lastName].filter(Boolean).join(" "),
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

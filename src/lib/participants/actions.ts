"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { db } from "@/lib/db"
import { getAuthSession, canManage, isAdmin } from "@/lib/auth-helpers"
import type { ActionResult } from "@/lib/types"
import type { AuditEventType } from "@/lib/auditLog/types"

const ParticipantSchema = z.object({
  firstName: z.string().min(1, "Vorname ist erforderlich").max(100, "Vorname zu lang"),
  lastName: z.string().min(1, "Nachname ist erforderlich").max(100, "Nachname zu lang"),
  contact: z
    .string()
    .max(255, "Kontakt zu lang")
    .nullable()
    .optional()
    .transform((v) => (v && v.trim().length > 0 ? v.trim() : null)),
})

function revalidateParticipantPaths(): void {
  revalidatePath("/participants")
  revalidatePath("/participants", "layout")
}

// ─────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────

export async function createParticipant(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet" }
  if (!canManage(session.user.role)) return { error: "Keine Berechtigung" }

  const parsed = ParticipantSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    contact: formData.get("contact"),
  })
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const contact = parsed.data.contact ?? null

  if (contact) {
    const existing = await db.participant.findUnique({ where: { contact }, select: { id: true } })
    if (existing) return { error: "Diese Kontaktangabe wird bereits verwendet." }
  }

  const newParticipant = await db.participant.create({
    data: {
      firstName: parsed.data.firstName.trim(),
      lastName: parsed.data.lastName.trim(),
      contact,
      createdByUserId: session.user.id,
    },
    select: { id: true },
  })

  await db.auditLog.create({
    data: {
      eventType: "PARTICIPANT_CREATED" satisfies AuditEventType,
      entityType: "PARTICIPANT",
      entityId: newParticipant.id,
      userId: session.user.id,
      details: {
        firstName: parsed.data.firstName.trim(),
        lastName: parsed.data.lastName.trim(),
      },
    },
  })

  revalidateParticipantPaths()
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────────────────────

export async function updateParticipant(
  id: string,
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet" }
  if (!canManage(session.user.role)) return { error: "Keine Berechtigung" }

  const participant = await db.participant.findUnique({ where: { id }, select: { id: true } })
  if (!participant) return { error: "Teilnehmer nicht gefunden." }

  const parsed = ParticipantSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    contact: formData.get("contact"),
  })
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const contact = parsed.data.contact ?? null

  if (contact) {
    const contactConflict = await db.participant.findFirst({
      where: { contact, NOT: { id } },
      select: { id: true },
    })
    if (contactConflict) return { error: "Diese Kontaktangabe wird bereits verwendet." }
  }

  await db.participant.update({
    where: { id },
    data: {
      firstName: parsed.data.firstName.trim(),
      lastName: parsed.data.lastName.trim(),
      contact,
    },
  })

  await db.auditLog.create({
    data: {
      eventType: "PARTICIPANT_UPDATED" satisfies AuditEventType,
      entityType: "PARTICIPANT",
      entityId: id,
      userId: session.user.id,
      details: {
        firstName: parsed.data.firstName.trim(),
        lastName: parsed.data.lastName.trim(),
      },
    },
  })

  revalidateParticipantPaths()
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// ACTIVATE / DEACTIVATE
// ─────────────────────────────────────────────────────────────

export async function setParticipantActive(id: string, isActive: boolean): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet" }
  if (!canManage(session.user.role)) return { error: "Keine Berechtigung" }

  const participant = await db.participant.findUnique({
    where: { id },
    select: { id: true, firstName: true, lastName: true, isActive: true },
  })
  if (!participant) return { error: "Teilnehmer nicht gefunden." }
  if (participant.isActive === isActive) return { success: true }

  if (!isActive) {
    const activeEnrollments = await db.competitionParticipant.count({
      where: { participantId: id, status: "ACTIVE" },
    })
    if (activeEnrollments > 0) {
      return {
        error:
          "Teilnehmer hat aktive Meisterschafts-Einschreibungen und kann nicht deaktiviert werden. Bitte zuerst zurückziehen.",
      }
    }
  }

  await db.participant.update({ where: { id }, data: { isActive } })

  const eventType: AuditEventType = isActive ? "PARTICIPANT_REACTIVATED" : "PARTICIPANT_DEACTIVATED"
  await db.auditLog.create({
    data: {
      eventType,
      entityType: "PARTICIPANT",
      entityId: id,
      userId: session.user.id,
      details: {
        firstName: participant.firstName,
        lastName: participant.lastName,
      },
    },
  })

  revalidateParticipantPaths()
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────────────────────

export async function deleteParticipant(id: string, force: boolean): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet" }
  if (!canManage(session.user.role)) return { error: "Keine Berechtigung" }
  if (force && !isAdmin(session.user.role)) return { error: "Keine Berechtigung" }

  const participant = await db.participant.findUnique({
    where: { id },
    select: { id: true, firstName: true, lastName: true, isActive: true },
  })
  if (!participant) return { error: "Teilnehmer nicht gefunden." }
  if (participant.isActive) return { error: "Nur inaktive Teilnehmer können gelöscht werden." }

  const competitionCount = await db.competitionParticipant.count({
    where: { participantId: id },
  })

  if (!force) {
    if (competitionCount > 0) {
      return {
        error: "Dieser Teilnehmer hat historische Daten. Force-Delete ist nur für Admins möglich.",
      }
    }

    await db.participant.delete({ where: { id } })
    await db.auditLog.create({
      data: {
        eventType: "PARTICIPANT_DELETED" satisfies AuditEventType,
        entityType: "PARTICIPANT",
        entityId: id,
        userId: session.user.id,
        details: { firstName: participant.firstName, lastName: participant.lastName },
      },
    })
    revalidateParticipantPaths()
    return { success: true }
  }

  // Force delete — cascade in transaction
  try {
    await db.$transaction(async (tx) => {
      // 1. Playoff-Struktur für diesen Teilnehmer
      const playoffMatches = await tx.playoffMatch.findMany({
        where: { OR: [{ participantAId: id }, { participantBId: id }] },
        select: { id: true },
      })
      const playoffMatchIds = playoffMatches.map((m) => m.id)

      if (playoffMatchIds.length > 0) {
        const playoffDuels = await tx.playoffDuel.findMany({
          where: { playoffMatchId: { in: playoffMatchIds } },
          select: { id: true },
        })
        const playoffDuelIds = playoffDuels.map((d) => d.id)

        if (playoffDuelIds.length > 0) {
          await tx.playoffDuelResult.deleteMany({ where: { duelId: { in: playoffDuelIds } } })
          await tx.playoffDuel.deleteMany({ where: { id: { in: playoffDuelIds } } })
        }
        await tx.playoffMatch.deleteMany({ where: { id: { in: playoffMatchIds } } })
      }

      // 2. Matchups + Serien beider Teilnehmer in diesen Paarungen
      const matchups = await tx.matchup.findMany({
        where: { OR: [{ homeParticipantId: id }, { awayParticipantId: id }] },
        select: { id: true },
      })
      const matchupIds = matchups.map((m) => m.id)

      if (matchupIds.length > 0) {
        await tx.series.deleteMany({ where: { matchupId: { in: matchupIds } } })
        await tx.matchup.deleteMany({ where: { id: { in: matchupIds } } })
      }

      // 3. Restliche Serien (Event/Saison — ohne matchupId)
      await tx.series.deleteMany({ where: { participantId: id } })

      // 4. Wettbewerbs-Einschreibungen
      await tx.competitionParticipant.deleteMany({ where: { participantId: id } })

      // 5. Teilnehmer + Audit-Eintrag
      await tx.participant.delete({ where: { id } })
      await tx.auditLog.create({
        data: {
          eventType: "PARTICIPANT_FORCE_DELETED" satisfies AuditEventType,
          entityType: "PARTICIPANT",
          entityId: id,
          userId: session.user.id,
          details: {
            firstName: participant.firstName,
            lastName: participant.lastName,
            competitions: competitionCount,
          },
        },
      })
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error("Fehler beim endgültigen Löschen des Teilnehmers:", msg)
    return { error: "Teilnehmer konnte nicht gelöscht werden." }
  }

  revalidateParticipantPaths()
  return { success: true }
}

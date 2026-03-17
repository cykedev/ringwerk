"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { db } from "@/lib/db"
import { getAuthSession } from "@/lib/auth-helpers"
import type { ActionResult } from "@/lib/types"

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
  if (session.user.role !== "ADMIN") return { error: "Keine Berechtigung" }

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

  await db.participant.create({
    data: {
      firstName: parsed.data.firstName.trim(),
      lastName: parsed.data.lastName.trim(),
      contact,
      createdByUserId: session.user.id,
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
  if (session.user.role !== "ADMIN") return { error: "Keine Berechtigung" }

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

  revalidateParticipantPaths()
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// ACTIVATE / DEACTIVATE
// ─────────────────────────────────────────────────────────────

export async function setParticipantActive(id: string, isActive: boolean): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet" }
  if (session.user.role !== "ADMIN") return { error: "Keine Berechtigung" }

  const participant = await db.participant.findUnique({
    where: { id },
    select: { id: true, isActive: true },
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
  revalidateParticipantPaths()
  return { success: true }
}

"use server"

import { z } from "zod"
import { db } from "@/lib/db"
import { getAuthSession } from "@/lib/auth-helpers"
import type { ActionResult } from "@/lib/types"
import type { AuditEventType } from "@/lib/auditLog/types"
import { parseDate, revalidateCompetitionPaths, BaseSchema } from "./_shared"

const CreateSchema = BaseSchema.extend({
  type: z.enum(["LEAGUE", "EVENT", "SEASON"], { message: "Ungültiger Wettbewerbstyp" }),
})

export async function createCompetition(
  _prevState: ActionResult<{ id: string }> | null,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet" }
  if (session.user.role !== "ADMIN") return { error: "Keine Berechtigung" }

  const parsed = CreateSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    scoringMode: formData.get("scoringMode"),
    shotsPerSeries: formData.get("shotsPerSeries"),
    disciplineId: formData.get("disciplineId"),
    hinrundeDeadline: formData.get("hinrundeDeadline"),
    rueckrundeDeadline: formData.get("rueckrundeDeadline"),
    eventDate: formData.get("eventDate"),
    allowGuests: formData.get("allowGuests"),
    teamSize: formData.get("teamSize"),
    teamScoring: formData.get("teamScoring"),
    targetValue: formData.get("targetValue"),
    targetValueType: formData.get("targetValueType"),
    minSeries: formData.get("minSeries"),
    seasonStart: formData.get("seasonStart"),
    seasonEnd: formData.get("seasonEnd"),
    playoffBestOf: formData.get("playoffBestOf"),
    playoffHasViertelfinale: formData.get("playoffHasViertelfinale"),
    playoffHasAchtelfinale: formData.get("playoffHasAchtelfinale"),
    finalePrimary: formData.get("finalePrimary"),
    finaleTiebreaker1: formData.get("finaleTiebreaker1"),
    finaleTiebreaker2: formData.get("finaleTiebreaker2"),
    finaleHasSuddenDeath: formData.get("finaleHasSuddenDeath"),
  })
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const { type, name, scoringMode, shotsPerSeries, disciplineId } = parsed.data

  if (disciplineId) {
    const discipline = await db.discipline.findUnique({
      where: { id: disciplineId },
      select: { id: true },
    })
    if (!discipline) return { error: "Disziplin nicht gefunden." }
  }

  const competition = await db.competition.create({
    data: {
      name,
      type,
      scoringMode,
      shotsPerSeries,
      disciplineId,
      hinrundeDeadline: parseDate(parsed.data.hinrundeDeadline),
      rueckrundeDeadline: parseDate(parsed.data.rueckrundeDeadline),
      eventDate: parseDate(parsed.data.eventDate),
      allowGuests: type === "EVENT" ? parsed.data.allowGuests : null,
      teamSize: type === "EVENT" ? (parsed.data.teamSize ?? null) : null,
      teamScoring: type === "EVENT" ? (parsed.data.teamScoring ?? null) : null,
      targetValue: type === "EVENT" ? (parsed.data.targetValue ?? null) : null,
      targetValueType: type === "EVENT" ? (parsed.data.targetValueType ?? null) : null,
      minSeries: type === "SEASON" ? (parsed.data.minSeries ?? null) : null,
      seasonStart: type === "SEASON" ? parseDate(parsed.data.seasonStart) : null,
      seasonEnd: type === "SEASON" ? parseDate(parsed.data.seasonEnd) : null,
      playoffBestOf: type === "LEAGUE" ? (parsed.data.playoffBestOf ?? null) : null,
      playoffHasViertelfinale: type === "LEAGUE" ? parsed.data.playoffHasViertelfinale : undefined,
      playoffHasAchtelfinale: type === "LEAGUE" ? parsed.data.playoffHasAchtelfinale : undefined,
      finalePrimary: type === "LEAGUE" ? parsed.data.finalePrimary : undefined,
      finaleTiebreaker1: type === "LEAGUE" ? (parsed.data.finaleTiebreaker1 ?? null) : null,
      finaleTiebreaker2: type === "LEAGUE" ? (parsed.data.finaleTiebreaker2 ?? null) : null,
      finaleHasSuddenDeath: type === "LEAGUE" ? parsed.data.finaleHasSuddenDeath : null,
      createdByUserId: session.user.id,
    },
    select: { id: true },
  })

  await db.auditLog.create({
    data: {
      eventType: "COMPETITION_CREATED" satisfies AuditEventType,
      entityType: "COMPETITION",
      entityId: competition.id,
      userId: session.user.id,
      competitionId: competition.id,
      details: {
        name,
        type,
        scoringMode,
      },
    },
  })

  revalidateCompetitionPaths()
  return { success: true, data: { id: competition.id } }
}

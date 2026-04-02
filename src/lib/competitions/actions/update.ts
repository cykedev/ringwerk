"use server"

import { db } from "@/lib/db"
import { getAuthSession, canManage } from "@/lib/auth-helpers"
import type { ActionResult } from "@/lib/types"
import type { CompetitionStatus } from "@/generated/prisma/client"
import type { AuditEventType } from "@/lib/auditLog/types"
import { parseDate, revalidateCompetitionPaths, BaseSchema } from "./_shared"

export async function updateCompetition(
  id: string,
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet" }
  if (!canManage(session.user.role)) return { error: "Keine Berechtigung" }

  const [competition, matchupCount] = await Promise.all([
    db.competition.findUnique({
      where: { id },
      select: { id: true, type: true, scoringMode: true },
    }),
    db.matchup.count({ where: { competitionId: id } }),
  ])
  if (!competition) return { error: "Wettbewerb nicht gefunden." }

  const rulesetLocked = matchupCount > 0

  const parsed = BaseSchema.safeParse({
    name: formData.get("name"),
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

  const type = competition.type

  await db.competition.update({
    where: { id },
    data: {
      name: parsed.data.name,
      scoringMode: rulesetLocked ? undefined : parsed.data.scoringMode,
      shotsPerSeries: rulesetLocked ? undefined : parsed.data.shotsPerSeries,
      hinrundeDeadline: parseDate(parsed.data.hinrundeDeadline),
      rueckrundeDeadline: parseDate(parsed.data.rueckrundeDeadline),
      eventDate: type === "EVENT" ? parseDate(parsed.data.eventDate) : undefined,
      allowGuests: type === "EVENT" ? parsed.data.allowGuests : undefined,
      teamSize: type === "EVENT" ? (parsed.data.teamSize ?? null) : undefined,
      teamScoring: type === "EVENT" ? (parsed.data.teamScoring ?? null) : undefined,
      targetValue: type === "EVENT" ? (parsed.data.targetValue ?? null) : undefined,
      targetValueType: type === "EVENT" ? (parsed.data.targetValueType ?? null) : undefined,
      minSeries: type === "SEASON" ? (parsed.data.minSeries ?? null) : undefined,
      seasonStart: type === "SEASON" ? parseDate(parsed.data.seasonStart) : undefined,
      seasonEnd: type === "SEASON" ? parseDate(parsed.data.seasonEnd) : undefined,
      playoffBestOf:
        type === "LEAGUE" && !rulesetLocked ? (parsed.data.playoffBestOf ?? null) : undefined,
      playoffHasViertelfinale:
        type === "LEAGUE" && !rulesetLocked ? parsed.data.playoffHasViertelfinale : undefined,
      playoffHasAchtelfinale:
        type === "LEAGUE" && !rulesetLocked ? parsed.data.playoffHasAchtelfinale : undefined,
      finalePrimary: type === "LEAGUE" && !rulesetLocked ? parsed.data.finalePrimary : undefined,
      finaleTiebreaker1:
        type === "LEAGUE" && !rulesetLocked ? (parsed.data.finaleTiebreaker1 ?? null) : undefined,
      finaleTiebreaker2:
        type === "LEAGUE" && !rulesetLocked ? (parsed.data.finaleTiebreaker2 ?? null) : undefined,
      finaleHasSuddenDeath:
        type === "LEAGUE" && !rulesetLocked ? parsed.data.finaleHasSuddenDeath : undefined,
    },
  })

  await db.auditLog.create({
    data: {
      eventType: "COMPETITION_UPDATED" satisfies AuditEventType,
      entityType: "COMPETITION",
      entityId: id,
      userId: session.user.id,
      competitionId: id,
      details: {
        name: parsed.data.name,
        type: competition.type,
        scoringMode: rulesetLocked ? competition.scoringMode : parsed.data.scoringMode,
      },
    },
  })

  revalidateCompetitionPaths()
  return { success: true }
}

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
  if (!canManage(session.user.role)) return { error: "Keine Berechtigung" }

  const competition = await db.competition.findUnique({
    where: { id },
    select: { id: true, name: true, status: true },
  })
  if (!competition) return { error: "Wettbewerb nicht gefunden." }

  if (!ALLOWED_TRANSITIONS[competition.status].includes(status)) {
    return {
      error: `Statuswechsel von ${competition.status} nach ${status} ist nicht erlaubt.`,
    }
  }

  await db.competition.update({ where: { id }, data: { status } })

  await db.auditLog.create({
    data: {
      eventType: "COMPETITION_STATUS_CHANGED" satisfies AuditEventType,
      entityType: "COMPETITION",
      entityId: id,
      userId: session.user.id,
      competitionId: id,
      details: {
        name: competition.name,
        from: competition.status,
        to: status,
      },
    },
  })

  revalidateCompetitionPaths()
  return { success: true }
}

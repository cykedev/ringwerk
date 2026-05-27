"use server"

import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import { getAuthSession, canManage } from "@/lib/auth-helpers"
import type { ActionResult } from "@/lib/types"
import type { CompetitionStatus } from "@/generated/prisma/client"
import type { AuditEventType } from "@/lib/auditLog/types"
import { parseDate, revalidateCompetitionPaths, BaseSchema, revalidatePublicSlug } from "./_shared"
import { findActiveSlugConflict } from "../publicSlug"

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
      select: {
        id: true,
        type: true,
        scoringMode: true,
        status: true,
        isPublic: true,
        publicSlug: true,
        publicPasswordHash: true,
      },
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
    isPublic: formData.get("isPublic"),
    publicSlug: formData.get("publicSlug"),
    publicPassword: formData.get("publicPassword"),
    removePublicPassword: formData.get("removePublicPassword"),
    finalePrimary: formData.get("finalePrimary"),
    finaleTiebreaker1: formData.get("finaleTiebreaker1"),
    finaleTiebreaker2: formData.get("finaleTiebreaker2"),
    finaleHasSuddenDeath: formData.get("finaleHasSuddenDeath"),
  })
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const willBePublic = parsed.data.isPublic
  const willHaveSlug = parsed.data.publicSlug
  const isActive = competition.status === "ACTIVE"

  // Slug conflict check: only block when the updated competition itself will be ACTIVE+isPublic.
  // DRAFT/COMPLETED competitions may share a slug with an active one — only one ACTIVE+isPublic is blocked at a time.
  if (willBePublic && willHaveSlug && isActive) {
    const conflict = await findActiveSlugConflict(willHaveSlug, id)
    if (conflict) {
      return {
        error: `Slug ist bereits vom aktiven Wettbewerb '${conflict.name}' belegt. Wählen Sie einen anderen Slug oder schließen Sie den anderen Wettbewerb zuerst ab.`,
      }
    }
  }

  // Three-way password hash semantics:
  // 1. removePublicPassword=true  → clear hash (null)
  // 2. publicPassword provided    → hash with bcrypt
  // 3. neither                    → undefined (Prisma: do not touch the column)
  let publicPasswordHashUpdate: string | null | undefined
  if (parsed.data.removePublicPassword) {
    publicPasswordHashUpdate = null
  } else if (parsed.data.publicPassword != null) {
    publicPasswordHashUpdate = await bcrypt.hash(parsed.data.publicPassword, 12)
  } else {
    publicPasswordHashUpdate = undefined // Prisma: do not touch the column
  }

  const type = competition.type

  await db.competition.update({
    where: { id },
    data: {
      name: parsed.data.name,
      isPublic: parsed.data.isPublic ?? false,
      publicSlug: parsed.data.publicSlug,
      publicPasswordHash: publicPasswordHashUpdate,
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

  // Revalidate old slug if it changed or publishing was turned off — cached PDF pages must reflect the change
  if (competition.publicSlug && competition.publicSlug !== parsed.data.publicSlug) {
    revalidatePublicSlug(competition.publicSlug)
  }
  if (competition.isPublic && !parsed.data.isPublic && competition.publicSlug) {
    revalidatePublicSlug(competition.publicSlug)
  }
  // Revalidate new slug so the public PDF page reflects the updated data immediately
  if (parsed.data.isPublic && parsed.data.publicSlug) {
    revalidatePublicSlug(parsed.data.publicSlug)
  }

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

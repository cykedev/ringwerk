"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { getAuthSession, canManage } from "@/lib/auth-helpers"
import type { ActionResult } from "@/lib/types"
import { calculateRingteiler, MAX_RINGS } from "./calculateResult"
import { effectiveTeilerFaktor } from "@/lib/scoring/calculateScore"
import { duelOutcome, resolveBestOf, stechschussOutcome } from "@/lib/scoring/bestOf"
import type { DuelSeries, BestOfStatus } from "@/lib/scoring/bestOf"
import type { ScoringMode } from "@/generated/prisma/client"
import { revalidatePublicSlugForCompetition } from "@/lib/competitions/actions/_shared"

// ─── Input Types ──────────────────────────────────────────────────────────────

export interface BestOfShooterInput {
  rings: number
  teiler: number
  shots?: string[]
}

export interface SaveBestOfDuelInput {
  matchupId: string
  duelNumber: number
  homeResult: BestOfShooterInput
  awayResult: BestOfShooterInput
}

export interface SaveStechschussInput {
  matchupId: string
  /** Single decimal shot value for the home participant. */
  homeShot: number
  /** Single decimal shot value for the away participant. */
  awayShot: number
}

// ─── Plain-number series entry (for evaluation without Decimal types) ─────────

interface PlainSeries {
  participantId: string
  rings: number
  teiler: number
  ringteiler: number
  /** The discipline's configured factor (used with competitionDisciplineId to compute correctedTeiler). */
  teilerFaktor: number
  duelNumber: number | null
  isTiebreak: boolean
}

// ─── Shared DB loader ─────────────────────────────────────────────────────────

async function loadMatchup(matchupId: string) {
  return db.matchup.findUnique({
    where: { id: matchupId },
    select: {
      id: true,
      status: true,
      round: true,
      dueDate: true,
      homeParticipantId: true,
      homeParticipant: { select: { firstName: true, lastName: true } },
      awayParticipantId: true,
      awayParticipant: { select: { firstName: true, lastName: true } },
      competitionId: true,
      competition: {
        select: {
          shotsPerSeries: true,
          disciplineId: true,
          discipline: {
            select: { id: true, scoringType: true, teilerFaktor: true },
          },
          scoringMode: true,
          groupBestOf: true,
          groupPlayAllDuels: true,
          groupTiebreaker1: true,
          groupTiebreaker2: true,
        },
      },
      series: {
        select: {
          participantId: true,
          rings: true,
          teiler: true,
          ringteiler: true,
          duelNumber: true,
          isTiebreak: true,
          discipline: { select: { teilerFaktor: true } },
        },
      },
    },
  })
}

type LoadedMatchup = NonNullable<Awaited<ReturnType<typeof loadMatchup>>>

// ─── Discipline resolution ────────────────────────────────────────────────────

/**
 * Resolves the discipline for home and away participants.
 * Mirrors saveMatchResult exactly: competition-level discipline takes priority;
 * for mixed competitions (disciplineId === null) we fall back to per-participant.
 */
async function resolveDisciplines(matchup: LoadedMatchup) {
  let homeDiscipline = matchup.competition.discipline
  let awayDiscipline = matchup.competition.discipline

  if (!homeDiscipline) {
    const [homeCp, awayCp] = await Promise.all([
      db.competitionParticipant.findFirst({
        where: {
          participantId: matchup.homeParticipantId,
          competitionId: matchup.competitionId,
        },
        select: { discipline: { select: { id: true, scoringType: true, teilerFaktor: true } } },
      }),
      db.competitionParticipant.findFirst({
        where: {
          participantId: matchup.awayParticipantId!,
          competitionId: matchup.competitionId,
        },
        select: { discipline: { select: { id: true, scoringType: true, teilerFaktor: true } } },
      }),
    ])
    homeDiscipline = homeCp?.discipline ?? null
    awayDiscipline = awayCp?.discipline ?? null
  }

  return { homeDiscipline, awayDiscipline }
}

// ─── Match-state evaluator ────────────────────────────────────────────────────

/**
 * Evaluates the best-of match state from a plain list of series.
 *
 * Uses plain numbers throughout so callers can mix DB-loaded and in-flight
 * series without fighting Prisma's Decimal type.
 *
 * Home participant = A, away participant = B.
 *
 * - Regular duels: evaluated with duelOutcome (uses correctedTeiler = teiler * effectiveTeilerFaktor).
 * - Tiebreak (Stechschuss) rounds: evaluated with stechschussOutcome (shot value in rings, higher wins),
 *   independent of scoringMode.
 */
function evaluateMatchState(
  homeId: string,
  awayId: string,
  series: PlainSeries[],
  competitionDisciplineId: string | null,
  scoringMode: ScoringMode,
  groupTiebreaker1: ScoringMode | null,
  groupTiebreaker2: ScoringMode | null,
  bestOf: number,
  playAll: boolean
): BestOfStatus {
  const regularByDuel = new Map<number, { home?: DuelSeries; away?: DuelSeries }>()
  const tiebreakByDuel = new Map<number, { homeRings?: number; awayRings?: number }>()

  for (const s of series) {
    if (s.duelNumber === null) continue

    if (s.isTiebreak) {
      // Stechschuss: only the shot value (rings) matters.
      const existing = tiebreakByDuel.get(s.duelNumber) ?? {}
      if (s.participantId === homeId) {
        tiebreakByDuel.set(s.duelNumber, { ...existing, homeRings: s.rings })
      } else if (s.participantId === awayId) {
        tiebreakByDuel.set(s.duelNumber, { ...existing, awayRings: s.rings })
      }
    } else {
      const factor = effectiveTeilerFaktor(competitionDisciplineId, s.teilerFaktor)
      const entry: DuelSeries = {
        rings: s.rings,
        correctedTeiler: s.teiler * factor,
        ringteiler: s.ringteiler,
      }
      const existing = regularByDuel.get(s.duelNumber) ?? {}
      if (s.participantId === homeId) {
        regularByDuel.set(s.duelNumber, { ...existing, home: entry })
      } else if (s.participantId === awayId) {
        regularByDuel.set(s.duelNumber, { ...existing, away: entry })
      }
    }
  }

  // Only evaluate complete pairs.
  const regularOutcomes = Array.from(regularByDuel.entries())
    .filter(([, pair]) => pair.home && pair.away)
    .sort(([a], [b]) => a - b)
    .map(([, pair]) =>
      duelOutcome(pair.home!, pair.away!, scoringMode, groupTiebreaker1, groupTiebreaker2)
    )

  const tiebreakOutcomes = Array.from(tiebreakByDuel.entries())
    .filter(([, pair]) => pair.homeRings !== undefined && pair.awayRings !== undefined)
    .sort(([a], [b]) => a - b)
    .map(([, pair]) => stechschussOutcome(pair.homeRings!, pair.awayRings!))

  return resolveBestOf(regularOutcomes, tiebreakOutcomes, { bestOf, playAll })
}

/**
 * Converts DB-loaded Decimal fields to plain numbers for evaluation.
 */
function toPlain(series: LoadedMatchup["series"]): PlainSeries[] {
  return series.map((s) => ({
    participantId: s.participantId,
    rings: s.rings.toNumber(),
    teiler: s.teiler.toNumber(),
    ringteiler: s.ringteiler.toNumber(),
    teilerFaktor: s.discipline?.teilerFaktor.toNumber() ?? 1,
    duelNumber: s.duelNumber,
    isTiebreak: s.isTiebreak,
  }))
}

// ─── saveBestOfDuel ───────────────────────────────────────────────────────────

/**
 * Records one duel (both shooters' series) for a BEST_OF_SINGLE matchup.
 *
 * Discipline resolution, ringteiler computation, and the upsert transaction
 * mirror saveMatchResult exactly. After writing, the match state is
 * re-evaluated using all series including the newly supplied values; if the
 * best-of is decided the matchup is set to COMPLETED.
 */
export async function saveBestOfDuel(input: SaveBestOfDuelInput): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet." }
  if (!canManage(session.user.role)) return { error: "Keine Berechtigung." }

  const matchup = await loadMatchup(input.matchupId)
  if (!matchup) return { error: "Paarung nicht gefunden." }
  if (matchup.status === "BYE") return { error: "Freilos-Paarungen haben keine Ergebnisse." }
  if (!matchup.awayParticipantId) return { error: "Ungültige Paarung: kein Gegner zugeordnet." }

  const { homeDiscipline, awayDiscipline } = await resolveDisciplines(matchup)
  if (!homeDiscipline || !awayDiscipline) return { error: "Disziplin nicht konfiguriert." }

  const competitionDisciplineId = matchup.competition.disciplineId
  const homeFaktor = effectiveTeilerFaktor(
    competitionDisciplineId,
    homeDiscipline.teilerFaktor.toNumber()
  )
  const awayFaktor = effectiveTeilerFaktor(
    competitionDisciplineId,
    awayDiscipline.teilerFaktor.toNumber()
  )

  const homeRingteiler = calculateRingteiler(
    input.homeResult.rings,
    input.homeResult.teiler,
    homeFaktor,
    MAX_RINGS[homeDiscipline.scoringType]
  )
  const awayRingteiler = calculateRingteiler(
    input.awayResult.rings,
    input.awayResult.teiler,
    awayFaktor,
    MAX_RINGS[awayDiscipline.scoringType]
  )

  const sessionDate = matchup.dueDate ?? new Date()
  const shotCount = input.homeResult.shots?.length ?? matchup.competition.shotsPerSeries

  // Determine if this specific duel number already has series (correction).
  const existingForDuel = matchup.series.filter((s) => s.duelNumber === input.duelNumber)
  const isCorrection = existingForDuel.length > 0

  // Build the full series list including the new values to re-evaluate state.
  const existingPlain = toPlain(matchup.series).filter((s) => s.duelNumber !== input.duelNumber)
  const updatedSeries: PlainSeries[] = [
    ...existingPlain,
    {
      participantId: matchup.homeParticipantId,
      rings: input.homeResult.rings,
      teiler: input.homeResult.teiler,
      ringteiler: homeRingteiler,
      // Raw (uncorrected) factor: evaluateMatchState applies effectiveTeilerFaktor itself.
      teilerFaktor: homeDiscipline.teilerFaktor.toNumber(),
      duelNumber: input.duelNumber,
      isTiebreak: false,
    },
    {
      participantId: matchup.awayParticipantId!,
      rings: input.awayResult.rings,
      teiler: input.awayResult.teiler,
      ringteiler: awayRingteiler,
      teilerFaktor: awayDiscipline.teilerFaktor.toNumber(),
      duelNumber: input.duelNumber,
      isTiebreak: false,
    },
  ]

  const matchState = evaluateMatchState(
    matchup.homeParticipantId,
    matchup.awayParticipantId!,
    updatedSeries,
    competitionDisciplineId,
    matchup.competition.scoringMode,
    matchup.competition.groupTiebreaker1 ?? null,
    matchup.competition.groupTiebreaker2 ?? null,
    matchup.competition.groupBestOf ?? 3,
    matchup.competition.groupPlayAllDuels
  )
  const newStatus = matchState.kind === "complete" ? "COMPLETED" : "PENDING"

  try {
    await db.$transaction(async (tx) => {
      await tx.series.upsert({
        where: {
          matchupId_participantId_duelNumber: {
            matchupId: input.matchupId,
            participantId: matchup.homeParticipantId,
            duelNumber: input.duelNumber,
          },
        },
        create: {
          matchupId: input.matchupId,
          participantId: matchup.homeParticipantId,
          disciplineId: homeDiscipline!.id,
          shotCount,
          sessionDate,
          rings: input.homeResult.rings,
          teiler: input.homeResult.teiler,
          ringteiler: homeRingteiler,
          importSource: "MANUAL",
          recordedByUserId: session.user.id,
          duelNumber: input.duelNumber,
          isTiebreak: false,
        },
        update: {
          disciplineId: homeDiscipline!.id,
          shotCount,
          sessionDate,
          rings: input.homeResult.rings,
          teiler: input.homeResult.teiler,
          ringteiler: homeRingteiler,
          recordedByUserId: session.user.id,
        },
      })

      await tx.series.upsert({
        where: {
          matchupId_participantId_duelNumber: {
            matchupId: input.matchupId,
            participantId: matchup.awayParticipantId!,
            duelNumber: input.duelNumber,
          },
        },
        create: {
          matchupId: input.matchupId,
          participantId: matchup.awayParticipantId!,
          disciplineId: awayDiscipline!.id,
          shotCount,
          sessionDate,
          rings: input.awayResult.rings,
          teiler: input.awayResult.teiler,
          ringteiler: awayRingteiler,
          importSource: "MANUAL",
          recordedByUserId: session.user.id,
          duelNumber: input.duelNumber,
          isTiebreak: false,
        },
        update: {
          disciplineId: awayDiscipline!.id,
          shotCount,
          sessionDate,
          rings: input.awayResult.rings,
          teiler: input.awayResult.teiler,
          ringteiler: awayRingteiler,
          recordedByUserId: session.user.id,
        },
      })

      await tx.matchup.update({
        where: { id: input.matchupId },
        data: { status: newStatus },
      })
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error("Fehler beim Speichern des Best-of-Duells:", msg)
    return { error: "Duell-Ergebnis konnte nicht gespeichert werden." }
  }

  await db.auditLog.create({
    data: {
      eventType: isCorrection ? "RESULT_CORRECTED" : "RESULT_ENTERED",
      entityType: "MATCHUP",
      entityId: input.matchupId,
      userId: session.user.id,
      competitionId: matchup.competitionId,
      details: {
        duelNumber: input.duelNumber,
        round: matchup.round,
        homeName: `${matchup.homeParticipant.firstName} ${matchup.homeParticipant.lastName}`,
        homeRings: input.homeResult.rings,
        homeTeiler: input.homeResult.teiler,
        awayName: `${matchup.awayParticipant!.firstName} ${matchup.awayParticipant!.lastName}`,
        awayRings: input.awayResult.rings,
        awayTeiler: input.awayResult.teiler,
      },
    },
  })

  revalidatePath(`/competitions/${matchup.competitionId}/schedule`)
  revalidatePath(`/competitions/${matchup.competitionId}/standings`)
  await revalidatePublicSlugForCompetition(matchup.competitionId)

  return { success: true }
}

// ─── saveStechschuss ──────────────────────────────────────────────────────────

/**
 * Records one Stechschuss round (both shooters) for a BEST_OF_SINGLE matchup.
 *
 * A Stechschuss is a single decimal shot that decides a level match. The shot
 * value is stored in `rings`; teiler/ringteiler are unused (stored as 0).
 * duelNumber is assigned after the last regular duel so the unique key stays
 * stable. The first Stechschuss gets regularMax + 1, subsequent rounds get
 * regularMax + 2, etc.
 *
 * When both sides already have a series for the same latest tiebreak
 * duelNumber, that round is treated as a correction and reuses that number.
 */
export async function saveStechschuss(input: SaveStechschussInput): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet." }
  if (!canManage(session.user.role)) return { error: "Keine Berechtigung." }

  const matchup = await loadMatchup(input.matchupId)
  if (!matchup) return { error: "Paarung nicht gefunden." }
  if (matchup.status === "BYE") return { error: "Freilos-Paarungen haben keine Ergebnisse." }
  if (!matchup.awayParticipantId) return { error: "Ungültige Paarung: kein Gegner zugeordnet." }

  const { homeDiscipline, awayDiscipline } = await resolveDisciplines(matchup)
  if (!homeDiscipline || !awayDiscipline) return { error: "Disziplin nicht konfiguriert." }

  // Use home discipline FK; both participants share the same type in a Best-of league.
  const disciplineId = homeDiscipline.id
  const sessionDate = matchup.dueDate ?? new Date()

  // Determine the duelNumber to use for this Stechschuss.
  const regularSeries = matchup.series.filter((s) => !s.isTiebreak && s.duelNumber !== null)
  const maxRegularDuel = regularSeries.reduce((max, s) => Math.max(max, s.duelNumber ?? 0), 0)

  const tiebreakSeries = matchup.series.filter((s) => s.isTiebreak && s.duelNumber !== null)

  // A correction reuses the duelNumber when both sides already have that round.
  const homeTbMax = tiebreakSeries
    .filter((s) => s.participantId === matchup.homeParticipantId)
    .reduce((max, s) => Math.max(max, s.duelNumber ?? 0), 0)
  const awayTbMax = tiebreakSeries
    .filter((s) => s.participantId === matchup.awayParticipantId!)
    .reduce((max, s) => Math.max(max, s.duelNumber ?? 0), 0)

  // If both sides have the same latest tiebreak duelNumber we need to decide:
  // was it a TIE (→ new round needed) or was it decided (→ correction of that round)?
  // A Stechschuss is decided purely by shot value (rings field), regardless of scoringMode.
  let latestTiebreakWasTie = false
  if (homeTbMax > 0 && homeTbMax === awayTbMax) {
    const homeTbSeries = tiebreakSeries.find(
      (s) => s.participantId === matchup.homeParticipantId && s.duelNumber === homeTbMax
    )
    const awayTbSeries = tiebreakSeries.find(
      (s) => s.participantId === matchup.awayParticipantId! && s.duelNumber === homeTbMax
    )
    if (homeTbSeries && awayTbSeries) {
      const outcome = stechschussOutcome(
        homeTbSeries.rings.toNumber(),
        awayTbSeries.rings.toNumber()
      )
      latestTiebreakWasTie = outcome === "TIE"
    }
  }

  // Correction: both sides have the same latest tiebreak duelNumber AND it was decided.
  // New round: the latest tiebreak was a tie (→ assign the next duelNumber).
  const isCorrection = homeTbMax > 0 && homeTbMax === awayTbMax && !latestTiebreakWasTie
  const tiebreakDuelNumber = isCorrection
    ? homeTbMax
    : Math.max(maxRegularDuel, homeTbMax, awayTbMax) + 1

  // Compute ringteiler for the Stechschuss shot so the RINGTEILER comparator
  // can rank them correctly: ringteiler = maxRings - shot + 0 (teiler unused).
  // Lower ringteiler = higher shot = better result.
  const homeMaxRings = MAX_RINGS[homeDiscipline.scoringType]
  const homeStechRingteiler = calculateRingteiler(input.homeShot, 0, 1, homeMaxRings)
  const awayMaxRings = MAX_RINGS[awayDiscipline.scoringType]
  const awayStechRingteiler = calculateRingteiler(input.awayShot, 0, 1, awayMaxRings)

  // Build updated series list (replace this tiebreak slot if correcting).
  const existingPlain = toPlain(matchup.series).filter(
    (s) => !(s.isTiebreak && s.duelNumber === tiebreakDuelNumber)
  )
  const updatedSeries: PlainSeries[] = [
    ...existingPlain,
    {
      participantId: matchup.homeParticipantId,
      rings: input.homeShot,
      teiler: 0,
      ringteiler: homeStechRingteiler,
      // teilerFaktor is irrelevant for tiebreaks (evaluated by stechschussOutcome).
      teilerFaktor: 1,
      duelNumber: tiebreakDuelNumber,
      isTiebreak: true,
    },
    {
      participantId: matchup.awayParticipantId!,
      rings: input.awayShot,
      teiler: 0,
      ringteiler: awayStechRingteiler,
      teilerFaktor: 1,
      duelNumber: tiebreakDuelNumber,
      isTiebreak: true,
    },
  ]

  const matchState = evaluateMatchState(
    matchup.homeParticipantId,
    matchup.awayParticipantId!,
    updatedSeries,
    matchup.competition.disciplineId,
    matchup.competition.scoringMode,
    matchup.competition.groupTiebreaker1 ?? null,
    matchup.competition.groupTiebreaker2 ?? null,
    matchup.competition.groupBestOf ?? 3,
    matchup.competition.groupPlayAllDuels
  )
  const newStatus = matchState.kind === "complete" ? "COMPLETED" : "PENDING"

  try {
    await db.$transaction(async (tx) => {
      await tx.series.upsert({
        where: {
          matchupId_participantId_duelNumber: {
            matchupId: input.matchupId,
            participantId: matchup.homeParticipantId,
            duelNumber: tiebreakDuelNumber,
          },
        },
        create: {
          matchupId: input.matchupId,
          participantId: matchup.homeParticipantId,
          disciplineId,
          shotCount: 1,
          sessionDate,
          rings: input.homeShot,
          teiler: 0,
          // Store computed ringteiler so re-evaluation of stored series works correctly.
          ringteiler: homeStechRingteiler,
          importSource: "MANUAL",
          recordedByUserId: session.user.id,
          duelNumber: tiebreakDuelNumber,
          isTiebreak: true,
        },
        update: {
          rings: input.homeShot,
          ringteiler: homeStechRingteiler,
          recordedByUserId: session.user.id,
        },
      })

      await tx.series.upsert({
        where: {
          matchupId_participantId_duelNumber: {
            matchupId: input.matchupId,
            participantId: matchup.awayParticipantId!,
            duelNumber: tiebreakDuelNumber,
          },
        },
        create: {
          matchupId: input.matchupId,
          participantId: matchup.awayParticipantId!,
          disciplineId,
          shotCount: 1,
          sessionDate,
          rings: input.awayShot,
          teiler: 0,
          ringteiler: awayStechRingteiler,
          importSource: "MANUAL",
          recordedByUserId: session.user.id,
          duelNumber: tiebreakDuelNumber,
          isTiebreak: true,
        },
        update: {
          rings: input.awayShot,
          ringteiler: awayStechRingteiler,
          recordedByUserId: session.user.id,
        },
      })

      await tx.matchup.update({
        where: { id: input.matchupId },
        data: { status: newStatus },
      })
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error("Fehler beim Speichern des Stechschusses:", msg)
    return { error: "Stechschuss konnte nicht gespeichert werden." }
  }

  await db.auditLog.create({
    data: {
      // Reuse RESULT_ENTERED/RESULT_CORRECTED — no dedicated Stechschuss event yet.
      eventType: isCorrection ? "RESULT_CORRECTED" : "RESULT_ENTERED",
      entityType: "MATCHUP",
      entityId: input.matchupId,
      userId: session.user.id,
      competitionId: matchup.competitionId,
      details: {
        duelNumber: tiebreakDuelNumber,
        isTiebreak: true,
        round: matchup.round,
        homeName: `${matchup.homeParticipant.firstName} ${matchup.homeParticipant.lastName}`,
        homeShot: input.homeShot,
        awayName: `${matchup.awayParticipant!.firstName} ${matchup.awayParticipant!.lastName}`,
        awayShot: input.awayShot,
      },
    },
  })

  revalidatePath(`/competitions/${matchup.competitionId}/schedule`)
  revalidatePath(`/competitions/${matchup.competitionId}/standings`)
  await revalidatePublicSlugForCompetition(matchup.competitionId)

  return { success: true }
}

// ─── deleteLatestBestOfDuel ───────────────────────────────────────────────────

/**
 * Removes the highest-duelNumber series pair from a BEST_OF_SINGLE matchup and
 * resets its status to PENDING.
 *
 * This covers both regular duels and Stechschuss rounds; the distinction is
 * captured in the AuditLog details. There are no downstream playoff rounds
 * branching from group-phase matchups, so no cascade check is needed.
 */
export async function deleteLatestBestOfDuel(matchupId: string): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet." }
  if (!canManage(session.user.role)) return { error: "Keine Berechtigung." }

  const matchup = await loadMatchup(matchupId)
  if (!matchup) return { error: "Paarung nicht gefunden." }

  if (matchup.series.length === 0) {
    return { error: "Keine Serien vorhanden." }
  }

  const maxDuelNumber = matchup.series.reduce((max, s) => Math.max(max, s.duelNumber ?? 0), 0)

  if (maxDuelNumber === 0) {
    return { error: "Keine Serien mit Duell-Nummer vorhanden." }
  }

  const latestSeries = matchup.series.filter((s) => s.duelNumber === maxDuelNumber)
  const isTiebreakDeletion = latestSeries.some((s) => s.isTiebreak)

  try {
    await db.$transaction(async (tx) => {
      await tx.series.deleteMany({
        where: { matchupId, duelNumber: maxDuelNumber },
      })

      // Always reset to PENDING so the UI prompts for re-entry.
      await tx.matchup.update({
        where: { id: matchupId },
        data: { status: "PENDING" },
      })
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error("Fehler beim Löschen des Best-of-Duells:", msg)
    return { error: "Duell konnte nicht gelöscht werden." }
  }

  await db.auditLog.create({
    data: {
      // RESULT_CORRECTED is the closest existing event for a destructive correction.
      eventType: "RESULT_CORRECTED",
      entityType: "MATCHUP",
      entityId: matchupId,
      userId: session.user.id,
      competitionId: matchup.competitionId,
      details: {
        deletedDuelNumber: maxDuelNumber,
        isTiebreak: isTiebreakDeletion,
        round: matchup.round,
        homeName: `${matchup.homeParticipant.firstName} ${matchup.homeParticipant.lastName}`,
        awayName: `${matchup.awayParticipant?.firstName} ${matchup.awayParticipant?.lastName}`,
      },
    },
  })

  revalidatePath(`/competitions/${matchup.competitionId}/schedule`)
  revalidatePath(`/competitions/${matchup.competitionId}/standings`)
  await revalidatePublicSlugForCompetition(matchup.competitionId)

  return { success: true }
}

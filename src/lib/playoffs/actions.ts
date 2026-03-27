"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { getAuthSession } from "@/lib/auth-helpers"
import type { ActionResult } from "@/lib/types"
import { calculateRingteiler, MAX_RINGS } from "@/lib/results/calculateResult"
import { getStandingsForCompetition } from "@/lib/standings/queries"
import {
  createFirstRoundMatchups,
  createNextRoundMatchups,
  determineFinaleRoundWinner,
  determinePlayoffDuelWinner,
  finaleNeedsTeiler,
  getNextRound,
  isPlayoffMatchComplete,
  requiredWinsFromBestOf,
} from "./calculatePlayoffs"
import type { PlayoffRound, SavePlayoffDuelResultInput } from "./types"

/**
 * Startet die Playoff-Phase für eine Liga.
 * Erstellt die erste Runde (VF oder HF) basierend auf der aktuellen Tabelle.
 *
 * Voraussetzungen:
 * - Meisterschaft muss ACTIVE sein
 * - Playoffs noch nicht gestartet
 * - ≥ 4 aktive (nicht zurückgezogene) Teilnehmer
 * - Keine PENDING-Paarungen in der Gruppenphase
 */
export async function startPlayoffs(competitionId: string): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet." }
  if (session.user.role !== "ADMIN") return { error: "Keine Berechtigung." }

  const competition = await db.competition.findUnique({
    where: { id: competitionId },
    select: {
      id: true,
      status: true,
      playoffBestOf: true,
      playoffHasViertelfinale: true,
      playoffHasAchtelfinale: true,
    },
  })
  if (!competition) return { error: "Meisterschaft nicht gefunden." }
  if (competition.status !== "ACTIVE")
    return { error: "Playoffs können nur für aktive Meisterschaften gestartet werden." }

  const [existingCount, pendingCount] = await Promise.all([
    db.playoffMatch.count({ where: { competitionId } }),
    db.matchup.count({ where: { competitionId, status: "PENDING" } }),
  ])

  if (existingCount > 0) return { error: "Playoffs wurden bereits gestartet." }
  if (pendingCount > 0) return { error: "Es gibt noch ausstehende Paarungen in der Gruppenphase." }

  const standings = await getStandingsForCompetition(competitionId)
  const activeStandings = standings.filter((r) => !r.withdrawn)

  const minRequired = competition.playoffHasAchtelfinale
    ? 16
    : competition.playoffHasViertelfinale
      ? 8
      : 4
  if (activeStandings.length < minRequired) {
    return { error: `Mindestens ${minRequired} aktive Teilnehmer für Playoffs erforderlich.` }
  }

  const matchups = createFirstRoundMatchups(standings, {
    playoffHasViertelfinale: competition.playoffHasViertelfinale,
    playoffHasAchtelfinale: competition.playoffHasAchtelfinale,
  })

  try {
    await db.playoffMatch.createMany({
      data: matchups.map((m) => ({
        competitionId,
        round: m.round,
        participantAId: m.participantAId,
        participantBId: m.participantBId,
      })),
    })

    await db.auditLog.create({
      data: {
        eventType: "PLAYOFFS_STARTED",
        entityType: "COMPETITION",
        entityId: competitionId,
        userId: session.user.id,
        competitionId,
        details: { participantCount: activeStandings.length },
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error("Fehler beim Starten der Playoffs:", msg)
    return { error: "Playoffs konnten nicht gestartet werden." }
  }

  revalidatePath(`/competitions/${competitionId}/playoffs`)
  return { success: true }
}

/**
 * Speichert das Ergebnis eines Playoff-Einzel-Duells.
 * Aktualisiert den Siegstand und schließt den PlayoffMatch ab wenn nötig.
 * Bei abgeschlossenem PlayoffMatch: erstellt automatisch die nächste Runde.
 * Bei Finale-Gleichstand: erstellt ein Sudden-Death-Duell.
 * Bei VF/HF-Unentschieden: legt automatisch das nächste Duell an.
 */
export async function savePlayoffDuelResult(
  input: SavePlayoffDuelResultInput
): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet." }
  if (session.user.role !== "ADMIN") return { error: "Keine Berechtigung." }

  const duel = await db.playoffDuel.findUnique({
    where: { id: input.duelId },
    select: {
      id: true,
      duelNumber: true,
      isCompleted: true,
      playoffMatchId: true,
      results: {
        select: {
          participantId: true,
          totalRings: true,
          teiler: true,
          ringteiler: true,
        },
      },
      playoffMatch: {
        select: {
          id: true,
          round: true,
          winsA: true,
          winsB: true,
          status: true,
          competitionId: true,
          participantAId: true,
          participantA: { select: { firstName: true, lastName: true } },
          participantBId: true,
          participantB: { select: { firstName: true, lastName: true } },
          competition: {
            select: {
              discipline: { select: { scoringType: true, teilerFaktor: true } },
              playoffBestOf: true,
              finalePrimary: true,
              finaleTiebreaker1: true,
              finaleTiebreaker2: true,
              finaleHasSuddenDeath: true,
            },
          },
        },
      },
    },
  })

  if (!duel) return { error: "Duell nicht gefunden." }

  const isCorrection = duel.isCompleted
  const match = duel.playoffMatch
  const isFinal = match.round === "FINAL"
  const wasMatchComplete = match.status === "COMPLETED"
  const finalePrimary = match.competition.finalePrimary
  const finaleTiebreaker1 = match.competition.finaleTiebreaker1 ?? null
  const finaleTiebreaker2 = match.competition.finaleTiebreaker2 ?? null
  const finaleHasSuddenDeath = match.competition.finaleHasSuddenDeath ?? true
  const requiredWins = requiredWinsFromBestOf(match.competition.playoffBestOf)
  const finaleTeilerNeeded =
    isFinal && finaleNeedsTeiler(finalePrimary, finaleTiebreaker1, finaleTiebreaker2)

  // Korrektur nur erlaubt wenn Folge-Runde noch keine Duelle hat
  if (isCorrection && !isFinal) {
    const nextRound = getNextRound(match.round)!
    const nextMatchWithDuels = await db.playoffMatch.findFirst({
      where: {
        competitionId: match.competitionId,
        round: nextRound,
        duels: { some: {} },
        OR: [
          { participantAId: match.participantAId },
          { participantAId: match.participantBId },
          { participantBId: match.participantAId },
          { participantBId: match.participantBId },
        ],
      },
    })
    if (nextMatchWithDuels) {
      return {
        error: "Korrektur nicht möglich — in der nächsten Runde wurden bereits Duelle gespielt.",
      }
    }
  }

  // Finale: Kette primary → tb1 → tb2; VF/HF: Ringteiler-Berechnung
  let ringteilerA: number | null = null
  let ringteilerB: number | null = null
  let outcome: "A" | "B" | "DRAW"

  if (isFinal && !finaleTeilerNeeded) {
    outcome = determineFinaleRoundWinner(
      input.totalRingsA,
      input.totalRingsB,
      finalePrimary,
      undefined,
      undefined,
      undefined,
      undefined,
      finaleTiebreaker1,
      finaleTiebreaker2
    )
  } else {
    if (!duel.playoffMatch.competition.discipline) return { error: "Disziplin nicht konfiguriert." }
    const maxRings = MAX_RINGS[duel.playoffMatch.competition.discipline.scoringType]
    const faktor = duel.playoffMatch.competition.discipline.teilerFaktor.toNumber()
    ringteilerA = calculateRingteiler(input.totalRingsA, input.teilerA ?? 0, faktor, maxRings)
    ringteilerB = calculateRingteiler(input.totalRingsB, input.teilerB ?? 0, faktor, maxRings)
    if (isFinal) {
      outcome = determineFinaleRoundWinner(
        input.totalRingsA,
        input.totalRingsB,
        finalePrimary,
        ringteilerA,
        input.teilerA ?? 0,
        ringteilerB,
        input.teilerB ?? 0,
        finaleTiebreaker1,
        finaleTiebreaker2
      )
    } else {
      outcome = determinePlayoffDuelWinner(
        ringteilerA,
        input.totalRingsA,
        input.teilerA ?? 0,
        ringteilerB,
        input.totalRingsB,
        input.teilerB ?? 0
      )
    }
  }

  // Siege neu berechnen: bei Korrektur alten Outcome subtrahieren, neuen addieren
  let newWinsA = match.winsA
  let newWinsB = match.winsB
  if (isCorrection) {
    const oldResultA = duel.results.find((r) => r.participantId === match.participantAId)
    const oldResultB = duel.results.find((r) => r.participantId === match.participantBId)
    if (oldResultA && oldResultB) {
      let oldOutcome: "A" | "B" | "DRAW"
      if (isFinal && !finaleNeedsTeiler(finalePrimary, finaleTiebreaker1, finaleTiebreaker2)) {
        oldOutcome = determineFinaleRoundWinner(
          oldResultA.totalRings.toNumber(),
          oldResultB.totalRings.toNumber(),
          finalePrimary,
          undefined,
          undefined,
          undefined,
          undefined,
          finaleTiebreaker1,
          finaleTiebreaker2
        )
      } else {
        oldOutcome = determinePlayoffDuelWinner(
          oldResultA.ringteiler?.toNumber() ?? 0,
          oldResultA.totalRings.toNumber(),
          oldResultA.teiler?.toNumber() ?? 0,
          oldResultB.ringteiler?.toNumber() ?? 0,
          oldResultB.totalRings.toNumber(),
          oldResultB.teiler?.toNumber() ?? 0
        )
      }
      if (oldOutcome === "A") newWinsA--
      else if (oldOutcome === "B") newWinsB--
    }
  }
  if (outcome === "A") newWinsA++
  else if (outcome === "B") newWinsB++

  const matchComplete =
    outcome !== "DRAW" && isPlayoffMatchComplete(newWinsA, newWinsB, match.round, requiredWins)
  const saveTeiler = !isFinal || finaleTeilerNeeded

  try {
    await db.$transaction(async (tx) => {
      // Ergebnisse für beide Teilnehmer upserten
      // Finale ohne Teiler: teiler + ringteiler bleiben null
      await tx.playoffDuelResult.upsert({
        where: {
          duelId_participantId: { duelId: input.duelId, participantId: match.participantAId },
        },
        create: {
          duelId: input.duelId,
          participantId: match.participantAId,
          totalRings: input.totalRingsA,
          teiler: saveTeiler ? (input.teilerA ?? null) : null,
          ringteiler: ringteilerA,
          importSource: "MANUAL",
          recordedByUserId: session.user.id,
        },
        update: {
          totalRings: input.totalRingsA,
          teiler: saveTeiler ? (input.teilerA ?? null) : null,
          ringteiler: ringteilerA,
          recordedByUserId: session.user.id,
        },
      })

      await tx.playoffDuelResult.upsert({
        where: {
          duelId_participantId: { duelId: input.duelId, participantId: match.participantBId },
        },
        create: {
          duelId: input.duelId,
          participantId: match.participantBId,
          totalRings: input.totalRingsB,
          teiler: saveTeiler ? (input.teilerB ?? null) : null,
          ringteiler: ringteilerB,
          importSource: "MANUAL",
          recordedByUserId: session.user.id,
        },
        update: {
          totalRings: input.totalRingsB,
          teiler: saveTeiler ? (input.teilerB ?? null) : null,
          ringteiler: ringteilerB,
          recordedByUserId: session.user.id,
        },
      })

      // Duell als abgeschlossen markieren
      await tx.playoffDuel.update({
        where: { id: input.duelId },
        data: { isCompleted: true },
      })

      // Siege-Stand und Match-Status aktualisieren
      await tx.playoffMatch.update({
        where: { id: match.id },
        data: {
          winsA: newWinsA,
          winsB: newWinsB,
          status: matchComplete ? "COMPLETED" : "PENDING",
        },
      })
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error("Fehler beim Speichern des Playoff-Ergebnisses:", msg)
    return { error: "Ergebnis konnte nicht gespeichert werden." }
  }

  await db.auditLog.create({
    data: {
      eventType: isCorrection ? "PLAYOFF_RESULT_CORRECTED" : "PLAYOFF_RESULT_ENTERED",
      entityType: "PLAYOFF_DUEL",
      entityId: input.duelId,
      userId: session.user.id,
      competitionId: match.competitionId,
      details: {
        duelId: input.duelId,
        matchId: match.id,
        round: match.round,
        duelNumber: duel.duelNumber,
        nameA: `${match.participantA.firstName} ${match.participantA.lastName}`,
        nameB: `${match.participantB.firstName} ${match.participantB.lastName}`,
        totalRingsA: input.totalRingsA,
        teilerA: saveTeiler ? (input.teilerA ?? null) : null,
        totalRingsB: input.totalRingsB,
        teilerB: saveTeiler ? (input.teilerB ?? null) : null,
      },
    },
  })

  // Nach der Transaktion: Folge-Aktionen
  if (outcome === "DRAW" && !isCorrection) {
    if (isFinal) {
      // Finale-Gleichstand → Sudden-Death-Duell anlegen (wenn finaleHasSuddenDeath)
      if (finaleHasSuddenDeath) {
        await addExtraDuel(match.id, true)
      }
    } else {
      // VF/HF-Unentschieden → nächstes Duell automatisch anlegen
      await addExtraDuel(match.id, false)
    }
  }

  // Wenn Korrektur ein abgeschlossenes Match wieder öffnet → leere Folge-Runden-Matches löschen
  if (isCorrection && wasMatchComplete && !matchComplete && !isFinal) {
    await cascadeDeleteEmptyNextRound(match)
  }

  revalidatePath(`/competitions/${match.competitionId}/playoffs`)
  return { success: true }
}

/**
 * Löscht das letzte Duell einer Playoff-Paarung (inkl. Ergebnisse).
 * Nur möglich solange keine Folge-Runde angesetzt wurde.
 */
export async function deleteLastPlayoffDuel(duelId: string): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet." }
  if (session.user.role !== "ADMIN") return { error: "Keine Berechtigung." }

  const duel = await db.playoffDuel.findUnique({
    where: { id: duelId },
    select: {
      id: true,
      duelNumber: true,
      isCompleted: true,
      playoffMatch: {
        select: {
          id: true,
          round: true,
          winsA: true,
          winsB: true,
          competitionId: true,
          participantAId: true,
          participantA: { select: { firstName: true, lastName: true } },
          participantBId: true,
          participantB: { select: { firstName: true, lastName: true } },
        },
      },
      results: {
        select: {
          participantId: true,
          totalRings: true,
          teiler: true,
          ringteiler: true,
        },
      },
    },
  })

  if (!duel) return { error: "Duell nicht gefunden." }

  const match = duel.playoffMatch
  const isFinal = match.round === "FINAL"

  // Muss das letzte Duell sein
  const maxDuelNumber = await db.playoffDuel.aggregate({
    where: { playoffMatchId: match.id },
    _max: { duelNumber: true },
  })
  if (duel.duelNumber !== maxDuelNumber._max.duelNumber) {
    return { error: "Nur das letzte Duell kann gelöscht werden." }
  }

  // Löschen nur erlaubt wenn Folge-Runde noch keine Duelle hat
  if (!isFinal) {
    const nextRound = getNextRound(match.round)!
    const nextMatchWithDuels = await db.playoffMatch.findFirst({
      where: {
        competitionId: match.competitionId,
        round: nextRound,
        duels: { some: {} },
        OR: [
          { participantAId: match.participantAId },
          { participantAId: match.participantBId },
          { participantBId: match.participantAId },
          { participantBId: match.participantBId },
        ],
      },
    })
    if (nextMatchWithDuels) {
      return {
        error: "Löschen nicht möglich — in der nächsten Runde wurden bereits Duelle gespielt.",
      }
    }
  }

  // Siege-Korrektur wenn Duell bereits abgeschlossen war
  let deltaWinsA = 0
  let deltaWinsB = 0
  if (duel.isCompleted) {
    const oldResultA = duel.results.find((r) => r.participantId === match.participantAId)
    const oldResultB = duel.results.find((r) => r.participantId === match.participantBId)
    if (oldResultA && oldResultB) {
      let oldOutcome: "A" | "B" | "DRAW"
      if (isFinal) {
        oldOutcome = determineFinaleRoundWinner(
          oldResultA.totalRings.toNumber(),
          oldResultB.totalRings.toNumber()
        )
      } else {
        oldOutcome = determinePlayoffDuelWinner(
          oldResultA.ringteiler?.toNumber() ?? 0,
          oldResultA.totalRings.toNumber(),
          oldResultA.teiler?.toNumber() ?? 0,
          oldResultB.ringteiler?.toNumber() ?? 0,
          oldResultB.totalRings.toNumber(),
          oldResultB.teiler?.toNumber() ?? 0
        )
      }
      if (oldOutcome === "A") deltaWinsA = -1
      else if (oldOutcome === "B") deltaWinsB = -1
    }
  }
  // Note: deleteLastPlayoffDuel loads no competition ruleset — finale scoring mode fallback is fine

  await db.$transaction(async (tx) => {
    await tx.playoffDuelResult.deleteMany({ where: { duelId: duel.id } })
    await tx.playoffDuel.delete({ where: { id: duel.id } })
    await tx.playoffMatch.update({
      where: { id: match.id },
      data: {
        winsA: match.winsA + deltaWinsA,
        winsB: match.winsB + deltaWinsB,
        status: "PENDING",
      },
    })

    // Leere Folge-Runden-Matches kaskadenweise löschen
    if (!isFinal) {
      const nextRound = getNextRound(match.round)!
      const emptyNextMatches = await tx.playoffMatch.findMany({
        where: {
          competitionId: match.competitionId,
          round: nextRound,
          duels: { none: {} },
          OR: [
            { participantAId: match.participantAId },
            { participantAId: match.participantBId },
            { participantBId: match.participantAId },
            { participantBId: match.participantBId },
          ],
        },
        select: { id: true },
      })
      for (const m of emptyNextMatches) {
        await tx.playoffMatch.delete({ where: { id: m.id } })
      }
    }
  })

  const deletedResultA = duel.results.find((r) => r.participantId === match.participantAId)
  const deletedResultB = duel.results.find((r) => r.participantId === match.participantBId)

  await db.auditLog.create({
    data: {
      eventType: "PLAYOFF_DUEL_DELETED",
      entityType: "PLAYOFF_DUEL",
      entityId: duel.id,
      userId: session.user.id,
      competitionId: match.competitionId,
      details: {
        duelId: duel.id,
        matchId: match.id,
        round: match.round,
        duelNumber: duel.duelNumber,
        nameA: `${match.participantA.firstName} ${match.participantA.lastName}`,
        nameB: `${match.participantB.firstName} ${match.participantB.lastName}`,
        wasCompleted: duel.isCompleted,
        totalRingsA: deletedResultA?.totalRings.toNumber() ?? null,
        teilerA: deletedResultA?.teiler?.toNumber() ?? null,
        totalRingsB: deletedResultB?.totalRings.toNumber() ?? null,
        teilerB: deletedResultB?.teiler?.toNumber() ?? null,
      },
    },
  })

  revalidatePath(`/competitions/${match.competitionId}/playoffs`)
  return { success: true }
}

/**
 * Löscht leere Folge-Runden-Matches (ohne Duelle) nach Ergebnis-Revert.
 */
async function cascadeDeleteEmptyNextRound(match: {
  round: PlayoffRound
  competitionId: string
  participantAId: string
  participantBId: string
}): Promise<void> {
  if (match.round === "FINAL") return
  const nextRound = getNextRound(match.round)!
  const emptyNextMatches = await db.playoffMatch.findMany({
    where: {
      competitionId: match.competitionId,
      round: nextRound,
      duels: { none: {} },
      OR: [
        { participantAId: match.participantAId },
        { participantAId: match.participantBId },
        { participantBId: match.participantAId },
        { participantBId: match.participantBId },
      ],
    },
    select: { id: true },
  })
  for (const m of emptyNextMatches) {
    await db.playoffMatch.delete({ where: { id: m.id } })
  }
}

/**
 * Setzt manuell die nächste Runde an, wenn alle Matches der aktuellen Runde abgeschlossen sind.
 * Nur Admin; ersetzt das frühere automatische Seeding.
 */
export async function advanceRound(competitionId: string): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet." }
  if (session.user.role !== "ADMIN") return { error: "Keine Berechtigung." }

  const matches = await db.playoffMatch.findMany({
    where: { competitionId },
    select: {
      id: true,
      round: true,
      status: true,
      winsA: true,
      winsB: true,
      participantAId: true,
      participantBId: true,
    },
  })

  if (matches.length === 0) return { error: "Keine Playoffs gefunden." }

  // Höchste Runde ohne Folge-Runde ermitteln
  const hasEF = matches.some((m) => m.round === "EIGHTH_FINAL")
  const hasQF = matches.some((m) => m.round === "QUARTER_FINAL")
  const hasSF = matches.some((m) => m.round === "SEMI_FINAL")
  const hasFinal = matches.some((m) => m.round === "FINAL")

  let roundToAdvance: PlayoffRound | null = null
  if (hasEF && !hasQF) {
    roundToAdvance = "EIGHTH_FINAL"
  } else if (hasQF && !hasSF) {
    roundToAdvance = "QUARTER_FINAL"
  } else if (hasSF && !hasFinal) {
    roundToAdvance = "SEMI_FINAL"
  }

  if (!roundToAdvance) return { error: "Keine Runde zum Anlegen der nächsten Runde." }

  const currentRoundMatches = matches.filter((m) => m.round === roundToAdvance)
  if (!currentRoundMatches.every((m) => m.status === "COMPLETED")) {
    return { error: "Noch nicht alle Matches der aktuellen Runde abgeschlossen." }
  }

  await handleMatchCompletion(currentRoundMatches[0].id, competitionId, roundToAdvance)

  revalidatePath(`/competitions/${competitionId}/playoffs`)
  return { success: true }
}

/**
 * Nach Abschluss eines PlayoffMatch: prüft ob alle Matches der Runde done sind.
 * Falls ja → nächste Runde erstellen.
 * Bei FINAL → keine weitere Runde.
 */
async function handleMatchCompletion(
  matchId: string,
  competitionId: string,
  round: PlayoffRound
): Promise<void> {
  if (round === "FINAL") return

  const allMatchesInRound = await db.playoffMatch.findMany({
    where: { competitionId, round },
    select: {
      id: true,
      status: true,
      winsA: true,
      winsB: true,
      participantAId: true,
      participantBId: true,
    },
  })

  const allComplete = allMatchesInRound.every((m) => m.status === "COMPLETED")
  if (!allComplete) return

  const winners = allMatchesInRound.map((m) =>
    m.winsA > m.winsB ? m.participantAId : m.participantBId
  )

  const nextRound = getNextRound(round)!

  if (nextRound === "FINAL") {
    await db.playoffMatch.create({
      data: {
        competitionId,
        round: "FINAL",
        participantAId: winners[0],
        participantBId: winners[1],
      },
    })
    return
  }

  // Re-Seeding nach Original-Gruppenrang
  const standings = await getStandingsForCompetition(competitionId)
  const rankMap = new Map(standings.map((s) => [s.participantId, s.rank]))
  const nextMatchups = createNextRoundMatchups(winners, rankMap)

  await db.playoffMatch.createMany({
    data: nextMatchups.map((m) => ({
      competitionId,
      round: nextRound,
      participantAId: m.participantAId,
      participantBId: m.participantBId,
    })),
  })
}

/**
 * Legt ein weiteres Duell nach Gleichstand an.
 * isSuddenDeath=true für Finale-Verlängerung, false für VF/HF-Nachschuss.
 */
async function addExtraDuel(playoffMatchId: string, isSuddenDeath: boolean): Promise<void> {
  const lastDuel = await db.playoffDuel.findFirst({
    where: { playoffMatchId },
    orderBy: { duelNumber: "desc" },
    select: { duelNumber: true },
  })

  await db.playoffDuel.create({
    data: {
      playoffMatchId,
      duelNumber: (lastDuel?.duelNumber ?? 0) + 1,
      isSuddenDeath,
    },
  })
}

/**
 * Legt das nächste Duell in einem PlayoffMatch an.
 * Wird für VF/HF aufgerufen wenn der Admin ein weiteres Duell starten will.
 */
export async function addPlayoffDuel(
  playoffMatchId: string
): Promise<ActionResult<{ duelId: string }>> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet." }
  if (session.user.role !== "ADMIN") return { error: "Keine Berechtigung." }

  const match = await db.playoffMatch.findUnique({
    where: { id: playoffMatchId },
    select: {
      id: true,
      status: true,
      competitionId: true,
      duels: { orderBy: { duelNumber: "desc" }, take: 1, select: { duelNumber: true } },
    },
  })

  if (!match) return { error: "Playoff-Paarung nicht gefunden." }
  if (match.status === "COMPLETED")
    return { error: "Diese Playoff-Paarung ist bereits abgeschlossen." }

  const nextDuelNumber = (match.duels[0]?.duelNumber ?? 0) + 1

  try {
    const duel = await db.playoffDuel.create({
      data: {
        playoffMatchId,
        duelNumber: nextDuelNumber,
        isSuddenDeath: false,
      },
      select: { id: true },
    })

    revalidatePath(`/competitions/${match.competitionId}/playoffs`)
    return { success: true, data: { duelId: duel.id } }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error("Fehler beim Anlegen des Duells:", msg)
    return { error: "Duell konnte nicht angelegt werden." }
  }
}

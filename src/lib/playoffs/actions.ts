"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { getAuthSession } from "@/lib/auth-helpers"
import type { ActionResult } from "@/lib/types"
import { calcRingteiler, MAX_RINGS } from "@/lib/results/calculateResult"
import { getStandingsForLeague } from "@/lib/standings/queries"
import {
  createFirstRoundMatchups,
  createNextRoundMatchups,
  determineFinaleRoundWinner,
  determinePlayoffDuelWinner,
  isPlayoffMatchComplete,
} from "./calculatePlayoffs"
import type { SavePlayoffDuelResultInput } from "./types"

/**
 * Startet die Playoff-Phase für eine Liga.
 * Erstellt die erste Runde (VF oder HF) basierend auf der aktuellen Tabelle.
 *
 * Voraussetzungen:
 * - Liga muss ACTIVE sein
 * - Playoffs noch nicht gestartet
 * - ≥ 4 aktive (nicht zurückgezogene) Teilnehmer
 * - Keine PENDING-Paarungen in der Gruppenphase
 */
export async function startPlayoffs(leagueId: string): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet." }
  if (session.user.role !== "ADMIN") return { error: "Keine Berechtigung." }

  const league = await db.league.findUnique({
    where: { id: leagueId },
    select: { id: true, status: true },
  })
  if (!league) return { error: "Liga nicht gefunden." }
  if (league.status !== "ACTIVE")
    return { error: "Playoffs können nur für aktive Ligen gestartet werden." }

  const [existingCount, pendingCount] = await Promise.all([
    db.playoffMatch.count({ where: { leagueId } }),
    db.matchup.count({ where: { leagueId, status: "PENDING" } }),
  ])

  if (existingCount > 0) return { error: "Playoffs wurden bereits gestartet." }
  if (pendingCount > 0) return { error: "Es gibt noch ausstehende Paarungen in der Gruppenphase." }

  const standings = await getStandingsForLeague(leagueId)
  const activeStandings = standings.filter((r) => !r.withdrawn)

  if (activeStandings.length < 4) {
    return { error: "Mindestens 4 aktive Teilnehmer für Playoffs erforderlich." }
  }

  const matchups = createFirstRoundMatchups(standings)

  try {
    await db.playoffMatch.createMany({
      data: matchups.map((m) => ({
        leagueId,
        round: m.round,
        participantAId: m.participantAId,
        participantBId: m.participantBId,
      })),
    })

    await db.auditLog.create({
      data: {
        eventType: "PLAYOFFS_STARTED",
        entityType: "LEAGUE",
        entityId: leagueId,
        userId: session.user.id,
        leagueId,
        details: { participantCount: activeStandings.length },
      },
    })
  } catch (error) {
    console.error("Fehler beim Starten der Playoffs:", error)
    return { error: "Playoffs konnten nicht gestartet werden." }
  }

  revalidatePath(`/leagues/${leagueId}/playoffs`)
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
          leagueId: true,
          participantAId: true,
          participantA: { select: { firstName: true, lastName: true } },
          participantBId: true,
          participantB: { select: { firstName: true, lastName: true } },
          league: { select: { discipline: { select: { scoringType: true } } } },
        },
      },
    },
  })

  if (!duel) return { error: "Duell nicht gefunden." }

  const isCorrection = duel.isCompleted
  const match = duel.playoffMatch
  const isFinal = match.round === "FINAL"
  const wasMatchComplete = match.status === "COMPLETED"

  // Korrektur nur erlaubt wenn Folge-Runde noch keine Duelle hat
  if (isCorrection && !isFinal) {
    const nextRound = match.round === "QUARTER_FINAL" ? "SEMI_FINAL" : "FINAL"
    const nextMatchWithDuels = await db.playoffMatch.findFirst({
      where: {
        leagueId: match.leagueId,
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

  // Finale: Einzelschüsse ohne Teiler → nur Ringvergleich
  // VF/HF: Ringteiler-Berechnung + vollständiger Vergleich
  let ringteilerA: number | null = null
  let ringteilerB: number | null = null
  let outcome: "A" | "B" | "DRAW"

  if (isFinal) {
    outcome = determineFinaleRoundWinner(input.totalRingsA, input.totalRingsB)
  } else {
    const maxRings = MAX_RINGS[duel.playoffMatch.league.discipline.scoringType]
    ringteilerA = calcRingteiler(maxRings, input.totalRingsA, input.teilerA ?? 0)
    ringteilerB = calcRingteiler(maxRings, input.totalRingsB, input.teilerB ?? 0)
    outcome = determinePlayoffDuelWinner(
      ringteilerA,
      input.totalRingsA,
      input.teilerA ?? 0,
      ringteilerB,
      input.totalRingsB,
      input.teilerB ?? 0
    )
  }

  // Siege neu berechnen: bei Korrektur alten Outcome subtrahieren, neuen addieren
  let newWinsA = match.winsA
  let newWinsB = match.winsB
  if (isCorrection) {
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
      if (oldOutcome === "A") newWinsA--
      else if (oldOutcome === "B") newWinsB--
    }
  }
  if (outcome === "A") newWinsA++
  else if (outcome === "B") newWinsB++

  const matchComplete =
    outcome !== "DRAW" && isPlayoffMatchComplete(newWinsA, newWinsB, match.round)

  try {
    await db.$transaction(async (tx) => {
      // Ergebnisse für beide Teilnehmer upserten
      // Finale: teiler + ringteiler bleiben null (Einzelschüsse ohne Teiler-Erfassung)
      await tx.playoffDuelResult.upsert({
        where: {
          duelId_participantId: { duelId: input.duelId, participantId: match.participantAId },
        },
        create: {
          duelId: input.duelId,
          participantId: match.participantAId,
          totalRings: input.totalRingsA,
          teiler: isFinal ? null : (input.teilerA ?? null),
          ringteiler: ringteilerA,
          importSource: "MANUAL",
          recordedByUserId: session.user.id,
        },
        update: {
          totalRings: input.totalRingsA,
          teiler: isFinal ? null : (input.teilerA ?? null),
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
          teiler: isFinal ? null : (input.teilerB ?? null),
          ringteiler: ringteilerB,
          importSource: "MANUAL",
          recordedByUserId: session.user.id,
        },
        update: {
          totalRings: input.totalRingsB,
          teiler: isFinal ? null : (input.teilerB ?? null),
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
    console.error("Fehler beim Speichern des Playoff-Ergebnisses:", error)
    return { error: "Ergebnis konnte nicht gespeichert werden." }
  }

  await db.auditLog.create({
    data: {
      eventType: isCorrection ? "PLAYOFF_RESULT_CORRECTED" : "PLAYOFF_RESULT_ENTERED",
      entityType: "PLAYOFF_DUEL",
      entityId: input.duelId,
      userId: session.user.id,
      leagueId: match.leagueId,
      details: {
        duelId: input.duelId,
        matchId: match.id,
        round: match.round,
        duelNumber: duel.duelNumber,
        nameA: `${match.participantA.firstName} ${match.participantA.lastName}`,
        nameB: `${match.participantB.firstName} ${match.participantB.lastName}`,
        totalRingsA: input.totalRingsA,
        teilerA: isFinal ? null : (input.teilerA ?? null),
        totalRingsB: input.totalRingsB,
        teilerB: isFinal ? null : (input.teilerB ?? null),
      },
    },
  })

  // Nach der Transaktion: Folge-Aktionen
  if (outcome === "DRAW" && !isCorrection) {
    if (isFinal) {
      // Finale-Gleichstand → Sudden-Death-Duell anlegen
      await addExtraDuel(match.id, true)
    } else {
      // VF/HF-Unentschieden → nächstes Duell automatisch anlegen
      await addExtraDuel(match.id, false)
    }
  }

  // Wenn Korrektur ein abgeschlossenes Match wieder öffnet → leere Folge-Runden-Matches löschen
  if (isCorrection && wasMatchComplete && !matchComplete && !isFinal) {
    await cascadeDeleteEmptyNextRound(match)
  }

  revalidatePath(`/leagues/${match.leagueId}/playoffs`)
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
          leagueId: true,
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
    const nextRound = match.round === "QUARTER_FINAL" ? "SEMI_FINAL" : "FINAL"
    const nextMatchWithDuels = await db.playoffMatch.findFirst({
      where: {
        leagueId: match.leagueId,
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
      const nextRound = match.round === "QUARTER_FINAL" ? "SEMI_FINAL" : "FINAL"
      const emptyNextMatches = await tx.playoffMatch.findMany({
        where: {
          leagueId: match.leagueId,
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
      leagueId: match.leagueId,
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

  revalidatePath(`/leagues/${match.leagueId}/playoffs`)
  return { success: true }
}

/**
 * Löscht leere Folge-Runden-Matches (ohne Duelle) nach Ergebnis-Revert.
 */
async function cascadeDeleteEmptyNextRound(match: {
  round: "QUARTER_FINAL" | "SEMI_FINAL" | "FINAL"
  leagueId: string
  participantAId: string
  participantBId: string
}): Promise<void> {
  if (match.round === "FINAL") return
  const nextRound = match.round === "QUARTER_FINAL" ? "SEMI_FINAL" : "FINAL"
  const emptyNextMatches = await db.playoffMatch.findMany({
    where: {
      leagueId: match.leagueId,
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
export async function advanceRound(leagueId: string): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet." }
  if (session.user.role !== "ADMIN") return { error: "Keine Berechtigung." }

  const matches = await db.playoffMatch.findMany({
    where: { leagueId },
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
  const hasSF = matches.some((m) => m.round === "SEMI_FINAL")
  const hasFinal = matches.some((m) => m.round === "FINAL")

  let roundToAdvance: "QUARTER_FINAL" | "SEMI_FINAL" | null = null
  if (hasSF && !hasFinal) {
    roundToAdvance = "SEMI_FINAL"
  } else if (!hasSF) {
    roundToAdvance = "QUARTER_FINAL"
  }

  if (!roundToAdvance) return { error: "Keine Runde zum Anlegen der nächsten Runde." }

  const currentRoundMatches = matches.filter((m) => m.round === roundToAdvance)
  if (!currentRoundMatches.every((m) => m.status === "COMPLETED")) {
    return { error: "Noch nicht alle Matches der aktuellen Runde abgeschlossen." }
  }

  await handleMatchCompletion(currentRoundMatches[0].id, leagueId, roundToAdvance)

  revalidatePath(`/leagues/${leagueId}/playoffs`)
  return { success: true }
}

/**
 * Nach Abschluss eines PlayoffMatch: prüft ob alle Matches der Runde done sind.
 * Falls ja → nächste Runde erstellen.
 * Bei FINAL → keine weitere Runde.
 */
async function handleMatchCompletion(
  matchId: string,
  leagueId: string,
  round: "QUARTER_FINAL" | "SEMI_FINAL" | "FINAL"
): Promise<void> {
  if (round === "FINAL") return

  // Alle Matches der aktuellen Runde laden
  const allMatchesInRound = await db.playoffMatch.findMany({
    where: { leagueId, round },
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

  // Gewinner der aktuellen Runde bestimmen
  const winners = allMatchesInRound.map((m) =>
    m.winsA > m.winsB ? m.participantAId : m.participantBId
  )

  const nextRound: "SEMI_FINAL" | "FINAL" = round === "QUARTER_FINAL" ? "SEMI_FINAL" : "FINAL"

  if (nextRound === "FINAL") {
    // Finale: die beiden HF-Gewinner spielen gegeneinander
    // Reihenfolge: erster Match-Gewinner vs. zweiter Match-Gewinner
    await db.playoffMatch.create({
      data: {
        leagueId,
        round: "FINAL",
        participantAId: winners[0],
        participantBId: winners[1],
      },
    })
    return
  }

  // SEMI_FINAL: Re-Seeding nach Original-Gruppenrang
  const standings = await getStandingsForLeague(leagueId)
  const rankMap = new Map(standings.map((s) => [s.participantId, s.rank]))
  const nextMatchups = createNextRoundMatchups(winners, rankMap)

  await db.playoffMatch.createMany({
    data: nextMatchups.map((m) => ({
      leagueId,
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
      leagueId: true,
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

    revalidatePath(`/leagues/${match.leagueId}/playoffs`)
    return { success: true, data: { duelId: duel.id } }
  } catch (error) {
    console.error("Fehler beim Anlegen des Duells:", error)
    return { error: "Duell konnte nicht angelegt werden." }
  }
}

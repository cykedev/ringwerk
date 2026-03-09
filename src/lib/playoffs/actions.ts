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
      playoffMatch: {
        select: {
          id: true,
          round: true,
          winsA: true,
          winsB: true,
          status: true,
          leagueId: true,
          participantAId: true,
          participantBId: true,
          league: { select: { discipline: { select: { scoringType: true } } } },
        },
      },
    },
  })

  if (!duel) return { error: "Duell nicht gefunden." }
  if (duel.isCompleted) return { error: "Dieses Duell wurde bereits abgeschlossen." }
  if (duel.playoffMatch.status === "COMPLETED") {
    return { error: "Diese Playoff-Paarung wurde bereits abgeschlossen." }
  }

  const match = duel.playoffMatch
  const isFinal = match.round === "FINAL"

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
  let newWinsA = match.winsA
  let newWinsB = match.winsB
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

  // Nach der Transaktion: Folge-Aktionen (nicht atomar, aber akzeptabel)
  if (matchComplete) {
    await handleMatchCompletion(match.id, match.leagueId, match.round)
  } else if (outcome === "DRAW" && match.round === "FINAL") {
    // Finale-Gleichstand → Sudden-Death-Duell anlegen
    await addSuddenDeathDuel(match.id)
  }

  revalidatePath(`/leagues/${match.leagueId}/playoffs`)
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

/** Legt ein neues Sudden-Death-Duell für ein Finale-Match an. */
async function addSuddenDeathDuel(playoffMatchId: string): Promise<void> {
  const lastDuel = await db.playoffDuel.findFirst({
    where: { playoffMatchId },
    orderBy: { duelNumber: "desc" },
    select: { duelNumber: true },
  })

  await db.playoffDuel.create({
    data: {
      playoffMatchId,
      duelNumber: (lastDuel?.duelNumber ?? 0) + 1,
      isSuddenDeath: true,
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

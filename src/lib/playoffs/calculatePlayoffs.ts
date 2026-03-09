import type { PlayoffRound } from "@/generated/prisma/client"
import type { StandingRow } from "@/lib/standings/calculateStandings"

export type PlayoffDuelOutcome = "A" | "B" | "DRAW"

/**
 * Bestimmt den Gewinner eines Finale-Einzelschusses.
 * Nur Ringvergleich – kein Teiler (Finale verwendet keine Teiler-Erfassung).
 * Höhere Ringzahl gewinnt. Bei Gleichstand: DRAW → Verlängerung (1 Schuss).
 */
export function determineFinaleRoundWinner(ringsA: number, ringsB: number): PlayoffDuelOutcome {
  if (ringsA > ringsB) return "A"
  if (ringsB > ringsA) return "B"
  return "DRAW"
}

/**
 * Bestimmt den Gewinner eines Playoff-Duells (VF/HF).
 * Logik identisch zu determineOutcome in calculateResult.ts,
 * aber mit A/B statt HOME/AWAY.
 * Niedrigerer Ringteiler gewinnt.
 * Bei Gleichstand: 1. höhere Seriensumme, 2. kleinerer Teiler, 3. DRAW.
 */
export function determinePlayoffDuelWinner(
  ringteilerA: number,
  totalRingsA: number,
  teilerA: number,
  ringteilerB: number,
  totalRingsB: number,
  teilerB: number
): PlayoffDuelOutcome {
  if (ringteilerA < ringteilerB) return "A"
  if (ringteilerA > ringteilerB) return "B"

  if (totalRingsA > totalRingsB) return "A"
  if (totalRingsA < totalRingsB) return "B"

  if (teilerA < teilerB) return "A"
  if (teilerA > teilerB) return "B"

  return "DRAW"
}

/**
 * Prüft ob ein PlayoffMatch abgeschlossen ist.
 * VF/HF (Best-of-Five): wer zuerst 3 Siege hat, gewinnt.
 * Finale: ein Sieg reicht (1 Duell + ggf. Sudden Death).
 */
export function isPlayoffMatchComplete(winsA: number, winsB: number, round: PlayoffRound): boolean {
  if (round === "FINAL") {
    return winsA >= 1 || winsB >= 1
  }
  return winsA >= 3 || winsB >= 3
}

/**
 * Erstellt die Paarungen der ersten Playoff-Runde anhand der Gruppenphase-Standings.
 * Nur aktive (nicht zurückgezogene) Teilnehmer qualifizieren sich.
 *
 * 4–7 aktive TN → SEMI_FINAL: 1v4, 2v3
 * 8+ aktive TN  → QUARTER_FINAL: 1v8, 2v7, 3v6, 4v5
 */
export function createFirstRoundMatchups(standings: StandingRow[]): {
  participantAId: string
  participantBId: string
  round: PlayoffRound
}[] {
  const active = standings.filter((r) => !r.withdrawn)

  if (active.length >= 8) {
    const top8 = active.slice(0, 8)
    return [
      {
        participantAId: top8[0].participantId,
        participantBId: top8[7].participantId,
        round: "QUARTER_FINAL",
      },
      {
        participantAId: top8[1].participantId,
        participantBId: top8[6].participantId,
        round: "QUARTER_FINAL",
      },
      {
        participantAId: top8[2].participantId,
        participantBId: top8[5].participantId,
        round: "QUARTER_FINAL",
      },
      {
        participantAId: top8[3].participantId,
        participantBId: top8[4].participantId,
        round: "QUARTER_FINAL",
      },
    ]
  }

  // 4–7 aktive TN → Halbfinale
  const top4 = active.slice(0, 4)
  return [
    {
      participantAId: top4[0].participantId,
      participantBId: top4[3].participantId,
      round: "SEMI_FINAL",
    },
    {
      participantAId: top4[1].participantId,
      participantBId: top4[2].participantId,
      round: "SEMI_FINAL",
    },
  ]
}

/**
 * Erstellt die Paarungen der nächsten Runde nach VF.
 * Re-Seeding: Gewinner nach Original-Gruppenrang sortieren,
 * dann bester vs. schlechtester.
 *
 * Ergibt 2 HF-Paarungen aus 4 VF-Gewinnern.
 */
export function createNextRoundMatchups(
  winners: string[],
  rankMap: Map<string, number>
): { participantAId: string; participantBId: string }[] {
  const sorted = [...winners].sort((a, b) => {
    const rankA = rankMap.get(a) ?? Infinity
    const rankB = rankMap.get(b) ?? Infinity
    return rankA - rankB
  })

  // Best vs worst, 2nd best vs 2nd worst
  return [
    { participantAId: sorted[0], participantBId: sorted[3] },
    { participantAId: sorted[1], participantBId: sorted[2] },
  ]
}

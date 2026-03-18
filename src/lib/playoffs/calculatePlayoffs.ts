import type { PlayoffRound } from "@/generated/prisma/client"
import type { ScoringMode } from "@/generated/prisma/client"
import type { StandingRow } from "@/lib/standings/calculateStandings"

export type PlayoffDuelOutcome = "A" | "B" | "DRAW"

export type PlayoffRuleset = {
  /** Wie viele Siege braucht man in VF/HF (z.B. 5 → 3 Siege nötig). Default: 5 */
  playoffBestOf: number | null
  /** Ob ein Viertelfinale gespielt wird (8 TN). Default: true */
  playoffHasViertelfinale: boolean | null
  /** Ob ein Achtelfinale gespielt wird (16 TN). Default: false */
  playoffHasAchtelfinale: boolean | null
  /** Hauptkriterium im Finale. Default: RINGS. */
  finalePrimary: ScoringMode
  /** Optionaler Tiebreaker 1. null = kein TB. */
  finaleTiebreaker1: ScoringMode | null
  /** Optionaler Tiebreaker 2. null = kein TB. Setzt TB1 voraus. */
  finaleTiebreaker2: ScoringMode | null
  /** Ob Sudden-Death nach Gleichstand im Finale gespielt wird. Default: true */
  finaleHasSuddenDeath: boolean | null
}

/**
 * Gibt die nächste Playoff-Runde zurück.
 * EIGHTH_FINAL → QUARTER_FINAL → SEMI_FINAL → FINAL → null
 */
export function getNextRound(round: PlayoffRound): PlayoffRound | null {
  if (round === "EIGHTH_FINAL") return "QUARTER_FINAL"
  if (round === "QUARTER_FINAL") return "SEMI_FINAL"
  if (round === "SEMI_FINAL") return "FINAL"
  return null
}

/**
 * Berechnet die nötige Siegzahl aus einer Best-of-N Konfiguration.
 * Best-of-5 → 3 Siege nötig. Best-of-3 → 2. Default: 3 (Best-of-5).
 */
export function requiredWinsFromBestOf(playoffBestOf: number | null): number {
  if (!playoffBestOf) return 3
  return Math.ceil(playoffBestOf / 2)
}

/**
 * Wendet ein einzelnes Kriterium auf die beiden Finale-Ergebnisse an.
 * Gibt "A", "B" oder "DRAW" zurück.
 */
function compareByFinale(
  criterion: ScoringMode,
  ringsA: number,
  ringsB: number,
  ringteilerA?: number,
  teilerA?: number,
  ringteilerB?: number,
  teilerB?: number
): PlayoffDuelOutcome {
  if (criterion === "RINGTEILER") {
    if (ringteilerA !== undefined && ringteilerB !== undefined) {
      if (ringteilerA < ringteilerB) return "A"
      if (ringteilerA > ringteilerB) return "B"
    }
    return "DRAW"
  }
  if (criterion === "TEILER") {
    if (teilerA !== undefined && teilerB !== undefined) {
      if (teilerA < teilerB) return "A"
      if (teilerA > teilerB) return "B"
    }
    return "DRAW"
  }
  // RINGS / RINGS_DECIMAL: höhere Ringzahl gewinnt
  if (ringsA > ringsB) return "A"
  if (ringsA < ringsB) return "B"
  return "DRAW"
}

/**
 * Bestimmt den Gewinner eines Finale-Einzelschusses.
 * Kette: finalePrimary → finaleTiebreaker1 → finaleTiebreaker2 → DRAW (Verlängerung).
 */
export function determineFinaleRoundWinner(
  ringsA: number,
  ringsB: number,
  finalePrimary?: ScoringMode | null,
  ringteilerA?: number,
  teilerA?: number,
  ringteilerB?: number,
  teilerB?: number,
  finaleTiebreaker1?: ScoringMode | null,
  finaleTiebreaker2?: ScoringMode | null
): PlayoffDuelOutcome {
  const primary = finalePrimary ?? "RINGS"
  const result1 = compareByFinale(
    primary,
    ringsA,
    ringsB,
    ringteilerA,
    teilerA,
    ringteilerB,
    teilerB
  )
  if (result1 !== "DRAW") return result1

  if (finaleTiebreaker1) {
    const result2 = compareByFinale(
      finaleTiebreaker1,
      ringsA,
      ringsB,
      ringteilerA,
      teilerA,
      ringteilerB,
      teilerB
    )
    if (result2 !== "DRAW") return result2
  }

  if (finaleTiebreaker2) {
    const result3 = compareByFinale(
      finaleTiebreaker2,
      ringsA,
      ringsB,
      ringteilerA,
      teilerA,
      ringteilerB,
      teilerB
    )
    if (result3 !== "DRAW") return result3
  }

  return "DRAW"
}

/**
 * Prüft ob das Finale-Ergebnis Teiler-Daten erfordert.
 * True wenn mindestens eines der Kriterien RINGTEILER oder TEILER ist.
 */
export function finaleNeedsTeiler(
  finalePrimary: ScoringMode,
  finaleTiebreaker1?: ScoringMode | null,
  finaleTiebreaker2?: ScoringMode | null
): boolean {
  const needsTeiler = (m: ScoringMode | null | undefined) => m === "RINGTEILER" || m === "TEILER"
  return (
    needsTeiler(finalePrimary) || needsTeiler(finaleTiebreaker1) || needsTeiler(finaleTiebreaker2)
  )
}

/**
 * Bestimmt den Gewinner eines Playoff-Duells (VF/HF).
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
 * VF/HF: wer zuerst die nötige Siegzahl erreicht, gewinnt.
 * Finale: ein Sieg reicht (1 Duell + ggf. Sudden Death).
 */
export function isPlayoffMatchComplete(
  winsA: number,
  winsB: number,
  round: PlayoffRound,
  requiredWins = 3
): boolean {
  if (round === "FINAL") {
    return winsA >= 1 || winsB >= 1
  }
  return winsA >= requiredWins || winsB >= requiredWins
}

/**
 * Erstellt die Paarungen der ersten Playoff-Runde anhand der Gruppenphase-Standings.
 * Nur aktive (nicht zurückgezogene) Teilnehmer qualifizieren sich.
 *
 * playoffHasAchtelfinale → EIGHTH_FINAL: Top 16, 1v16, 2v15, …
 * playoffHasViertelfinale → QUARTER_FINAL: Top 8, 1v8, 2v7, …
 * sonst → SEMI_FINAL: Top 4, 1v4, 2v3
 */
export function createFirstRoundMatchups(
  standings: StandingRow[],
  ruleset?: Pick<PlayoffRuleset, "playoffHasViertelfinale" | "playoffHasAchtelfinale"> | null
): { participantAId: string; participantBId: string; round: PlayoffRound }[] {
  const hasAF = ruleset?.playoffHasAchtelfinale ?? false
  const hasVF = hasAF || (ruleset?.playoffHasViertelfinale ?? true)

  const active = standings.filter((r) => !r.withdrawn)

  if (hasAF) {
    const top = active.slice(0, 16)
    return Array.from({ length: 8 }, (_, i) => ({
      participantAId: top[i].participantId,
      participantBId: top[15 - i].participantId,
      round: "EIGHTH_FINAL" as PlayoffRound,
    }))
  }

  if (hasVF) {
    const top = active.slice(0, 8)
    return Array.from({ length: 4 }, (_, i) => ({
      participantAId: top[i].participantId,
      participantBId: top[7 - i].participantId,
      round: "QUARTER_FINAL" as PlayoffRound,
    }))
  }

  // HF (default)
  const top = active.slice(0, 4)
  return Array.from({ length: 2 }, (_, i) => ({
    participantAId: top[i].participantId,
    participantBId: top[3 - i].participantId,
    round: "SEMI_FINAL" as PlayoffRound,
  }))
}

/**
 * Erstellt die Paarungen der nächsten Runde nach Re-Seeding.
 * Re-Seeding: Gewinner nach Original-Gruppenrang sortieren,
 * dann bester vs. schlechtester.
 *
 * Ergibt N/2 Paarungen aus N Gewinnern.
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

  const n = sorted.length
  return Array.from({ length: n / 2 }, (_, i) => ({
    participantAId: sorted[i],
    participantBId: sorted[n - 1 - i],
  }))
}

import type { ScoringType } from "@/generated/prisma/client"

/** Maximalringe pro Seite (10 Schuss) je Wertungsart */
export const MAX_RINGS: Record<ScoringType, number> = {
  WHOLE: 100,
  DECIMAL: 109,
}

export type MatchOutcome = "HOME_WIN" | "AWAY_WIN" | "DRAW"

/**
 * Berechnet den Ringteiler einer Serie.
 * Formel: MaxRinge − Gesamtringe + bester Teiler
 * Niedrigerer Wert = besseres Ergebnis.
 */
export function calcRingteiler(maxRings: number, totalRings: number, teiler: number): number {
  return maxRings - totalRings + teiler
}

/**
 * Bestimmt das Ergebnis eines Duells anhand der Ringteiler.
 * Niedrigerer Ringteiler gewinnt.
 * Bei Gleichstand (identischer Ringteiler):
 *   1. Bessere Serie (höhere Seriensumme) gewinnt
 *   2. Besserer Teiler (kleinerer Wert) gewinnt
 *   3. Kein Gewinner → DRAW
 */
export function determineOutcome(
  home: { totalRings: number; teiler: number; ringteiler: number },
  away: { totalRings: number; teiler: number; ringteiler: number }
): MatchOutcome {
  // Primär: Ringteiler (niedrigerer gewinnt)
  if (home.ringteiler < away.ringteiler) return "HOME_WIN"
  if (home.ringteiler > away.ringteiler) return "AWAY_WIN"

  // Gleichstand: Tiebreak 1 — höhere Seriensumme gewinnt
  if (home.totalRings > away.totalRings) return "HOME_WIN"
  if (home.totalRings < away.totalRings) return "AWAY_WIN"

  // Gleichstand: Tiebreak 2 — kleinerer Teiler gewinnt
  if (home.teiler < away.teiler) return "HOME_WIN"
  if (home.teiler > away.teiler) return "AWAY_WIN"

  return "DRAW"
}

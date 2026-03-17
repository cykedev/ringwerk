import type { ScoringMode, ScoringType } from "@/generated/prisma/client"
import { calculateRingteiler } from "@/lib/scoring/calculateScore"

export { calculateRingteiler }

/** Maximalringe pro Seite (10 Schuss) je Wertungsart */
export const MAX_RINGS: Record<ScoringType, number> = {
  WHOLE: 100,
  DECIMAL: 109,
}

export type MatchOutcome = "HOME_WIN" | "AWAY_WIN" | "DRAW"

/**
 * Bestimmt das Ergebnis eines Duells anhand der Ringteiler.
 * Niedrigerer Ringteiler gewinnt.
 * Bei Gleichstand (identischer Ringteiler):
 *   1. Bessere Serie (höhere Seriensumme) gewinnt
 *   2. Besserer Teiler (kleinerer Wert) gewinnt
 *   3. Kein Gewinner → DRAW
 *
 * Der scoringMode-Parameter bereitet Phase 6 vor (konfigurierbare Regelsets).
 * Aktuell wird immer RINGTEILER-Logik angewendet.
 */
export function determineOutcome(
  home: { rings: number; teiler: number; ringteiler: number },
  away: { rings: number; teiler: number; ringteiler: number },
  scoringMode: ScoringMode = "RINGTEILER"
): MatchOutcome {
  void scoringMode // Phase 6: Modi-spezifische Vergleichslogik implementieren

  // Primär: Ringteiler (niedrigerer gewinnt)
  if (home.ringteiler < away.ringteiler) return "HOME_WIN"
  if (home.ringteiler > away.ringteiler) return "AWAY_WIN"

  // Gleichstand: Tiebreak 1 — höhere Seriensumme gewinnt
  if (home.rings > away.rings) return "HOME_WIN"
  if (home.rings < away.rings) return "AWAY_WIN"

  // Gleichstand: Tiebreak 2 — kleinerer Teiler gewinnt
  if (home.teiler < away.teiler) return "HOME_WIN"
  if (home.teiler > away.teiler) return "AWAY_WIN"

  return "DRAW"
}

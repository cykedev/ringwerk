import type { ScoringMode } from "@/generated/prisma/client"
import type { ScoreInput } from "./types"

/**
 * Berechnet den korrigierten Teiler (Teiler × Disziplin-Faktor).
 * Formel: teiler * faktor
 */
export function calculateCorrectedTeiler(teiler: number, faktor: number): number {
  return teiler * faktor
}

/**
 * Berechnet den Ringteiler einer Serie.
 * Formel: MaxRinge − Ringe + (Teiler × Faktor)
 * Niedrigerer Wert = besseres Ergebnis.
 */
export function calculateRingteiler(
  rings: number,
  teiler: number,
  faktor: number,
  maxRings: number
): number {
  return maxRings - rings + teiler * faktor
}

/**
 * Berechnet die Summe der Nachkommastellen aller Schusswerte.
 * Beispiel: [9.5, 10.2, 8.7] → 0.5 + 0.2 + 0.7 = 1.4
 * Höherer Wert = besseres Ergebnis.
 */
function sumDecimalRests(shots: number[]): number {
  return shots.reduce((sum, shot) => sum + (shot % 1), 0)
}

/**
 * Berechnet den Wertungs-Score für einen Wettbewerbseintrag.
 *
 * Wertungsmodi und ihre Richtung:
 * - RINGTEILER:      MaxRinge − Ringe + (Teiler × Faktor) → niedrigster gewinnt
 * - RINGS:           Gesamtringe (ganzzahlig) → höchster gewinnt
 * - RINGS_DECIMAL:   Gesamtringe (Zehntelwertung) → höchster gewinnt
 * - TEILER:          Teiler × Faktor → niedrigster gewinnt
 * - DECIMAL_REST:    Summe der Nachkommastellen → höchster gewinnt
 * - TARGET_ABSOLUTE: |Messwert − Zielwert| → niedrigster gewinnt
 * - TARGET_UNDER:    Messwert ≤ Zielwert bevorzugt; niedrigste Abweichung gewinnt
 *   Kodierung: unter Zielwert → Abweichung direkt; über Zielwert → 1e9 + Abweichung
 *
 * Für TARGET_*: measuredValue vorab berechnen (z.B. correctedTeiler oder rings).
 */
export function calculateScore(mode: ScoringMode, input: ScoreInput): number {
  switch (mode) {
    case "RINGTEILER":
      return calculateRingteiler(input.rings, input.teiler, input.faktor, input.maxRings)

    case "RINGS":
      return input.rings

    case "RINGS_DECIMAL":
      return input.rings

    case "TEILER":
      return calculateCorrectedTeiler(input.teiler, input.faktor)

    case "DECIMAL_REST":
      return sumDecimalRests(input.shots ?? [])

    case "TARGET_ABSOLUTE": {
      const measured = input.measuredValue ?? input.rings
      return Math.abs(measured - (input.targetValue ?? 0))
    }

    case "TARGET_UNDER": {
      const measured = input.measuredValue ?? input.rings
      const target = input.targetValue ?? 0
      const deviation = Math.abs(measured - target)
      // Messwert ≤ Zielwert → bevorzugte Tier (direktes Abstand)
      // Messwert > Zielwert → schlechtere Tier (große Basiskonstante + Abstand)
      return measured <= target ? deviation : 1e9 + deviation
    }
  }
}

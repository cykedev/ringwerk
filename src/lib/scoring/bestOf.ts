import type { ScoringMode } from "@/generated/prisma/client"

export type DuelOutcome = "A" | "B" | "TIE"

export interface DuelSeries {
  rings: number
  /** teiler × effectiveTeilerFaktor — already normalized by the caller (factor only when mixed). */
  correctedTeiler: number
  /** stored Ringteiler (already effective-factor-corrected at save time). */
  ringteiler: number
}

/** -1 if A is better, 1 if B is better, 0 if equal on this mode. */
function compareByMode(a: DuelSeries, b: DuelSeries, mode: ScoringMode): -1 | 0 | 1 {
  if (mode === "RINGS" || mode === "RINGS_DECIMAL") {
    if (a.rings > b.rings) return -1
    if (a.rings < b.rings) return 1
    return 0
  }
  if (mode === "TEILER") {
    if (a.correctedTeiler < b.correctedTeiler) return -1
    if (a.correctedTeiler > b.correctedTeiler) return 1
    return 0
  }
  // RINGTEILER (and any fallback)
  if (a.ringteiler < b.ringteiler) return -1
  if (a.ringteiler > b.ringteiler) return 1
  return 0
}

export function duelOutcome(
  a: DuelSeries,
  b: DuelSeries,
  mode: ScoringMode,
  tiebreaker1: ScoringMode | null,
  tiebreaker2: ScoringMode | null
): DuelOutcome {
  for (const m of [mode, tiebreaker1, tiebreaker2]) {
    if (!m) continue
    const c = compareByMode(a, b, m)
    if (c !== 0) return c < 0 ? "A" : "B"
  }
  return "TIE"
}

export type BestOfStatus =
  | { kind: "in_progress" }
  | { kind: "needs_tiebreak" }
  | { kind: "complete"; winner: "A" | "B" }

export interface ResolveBestOfOptions {
  /** N in Best-of-N (odd). */
  bestOf: number
  /** Standard: play all N duels regardless of an early clinch. */
  playAll: boolean
}

function count(outcomes: DuelOutcome[]): { a: number; b: number } {
  return {
    a: outcomes.filter((o) => o === "A").length,
    b: outcomes.filter((o) => o === "B").length,
  }
}

/**
 * Resolves the current status of a best-of-N match.
 *
 * - TIE outcomes count for neither side.
 * - playAll=true: all N duels must be played before a winner can be declared.
 * - playAll=false: stops early once requiredWins = ceil(N/2) is reached.
 * - After N duels with a tie: Stechschuss rounds decide; first non-TIE wins.
 */
export function resolveBestOf(
  duels: DuelOutcome[],
  tiebreaks: DuelOutcome[],
  opts: ResolveBestOfOptions
): BestOfStatus {
  const requiredWins = Math.ceil(opts.bestOf / 2)
  const { a, b } = count(duels)

  // Early end: a clinch finishes the match immediately.
  if (!opts.playAll && (a >= requiredWins || b >= requiredWins)) {
    return { kind: "complete", winner: a > b ? "A" : "B" }
  }

  // Not yet all duels played → keep going.
  if (duels.length < opts.bestOf) return { kind: "in_progress" }

  // All N duels played.
  if (a > b) return { kind: "complete", winner: "A" }
  if (b > a) return { kind: "complete", winner: "B" }

  // Level → Stechschuss: first non-TIE round decides.
  const decided = tiebreaks.find((t) => t !== "TIE")
  if (decided) return { kind: "complete", winner: decided }
  return { kind: "needs_tiebreak" }
}

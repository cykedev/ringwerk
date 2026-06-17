export type DuelOutcome = "A" | "B" | "TIE"

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

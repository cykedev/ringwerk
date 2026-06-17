import { describe, expect, it } from "vitest"
import { resolveBestOf } from "./bestOf"

const opts = (o: Partial<{ bestOf: number; playAll: boolean }> = {}) => ({
  bestOf: 3,
  playAll: true,
  ...o,
})

describe("resolveBestOf", () => {
  it("playAll: A wins all three -> complete A after 3 duels", () => {
    expect(resolveBestOf(["A", "A", "A"], [], opts())).toEqual({ kind: "complete", winner: "A" })
  })
  it("playAll: still needs duels until N are played even when clinched", () => {
    expect(resolveBestOf(["A", "A"], [], opts())).toEqual({ kind: "in_progress" })
  })
  it("playAll: 2:1 after three -> complete A", () => {
    expect(resolveBestOf(["A", "B", "A"], [], opts())).toEqual({ kind: "complete", winner: "A" })
  })
  it("early end: 2:0 stops before third duel", () => {
    expect(resolveBestOf(["A", "A"], [], opts({ playAll: false }))).toEqual({
      kind: "complete",
      winner: "A",
    })
  })
  it("level after N (one TIE) -> needs_tiebreak", () => {
    expect(resolveBestOf(["A", "B", "TIE"], [], opts())).toEqual({ kind: "needs_tiebreak" })
  })
  it("level after N, Stechschuss decides B", () => {
    expect(resolveBestOf(["A", "B", "TIE"], ["B"], opts())).toEqual({
      kind: "complete",
      winner: "B",
    })
  })
  it("Stechschuss tie repeats", () => {
    expect(resolveBestOf(["TIE", "TIE", "TIE"], ["TIE"], opts())).toEqual({
      kind: "needs_tiebreak",
    })
  })
  it("best-of-5 early end at 3 wins", () => {
    expect(resolveBestOf(["A", "B", "A", "A"], [], opts({ bestOf: 5, playAll: false }))).toEqual({
      kind: "complete",
      winner: "A",
    })
  })
})

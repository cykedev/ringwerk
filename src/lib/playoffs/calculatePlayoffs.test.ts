import { describe, expect, it } from "vitest"
import type { StandingRow } from "@/lib/standings/calculateStandings"
import {
  createFirstRoundMatchups,
  createNextRoundMatchups,
  determineFinaleRoundWinner,
  determinePlayoffDuelWinner,
  isPlayoffMatchComplete,
} from "./calculatePlayoffs"

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeStandings(ids: string[], withdrawn: string[] = []): StandingRow[] {
  return ids.map((id, i) => ({
    participantId: id,
    firstName: "Name",
    lastName: `${i + 1}`,
    withdrawn: withdrawn.includes(id),
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    byes: 0,
    points: ids.length - i, // absteigend, damit Rang stimmt
    bestRingteiler: null,
    rank: i + 1,
  }))
}

// ─── determineFinaleRoundWinner ──────────────────────────────────────────────

describe("determineFinaleRoundWinner", () => {
  it("höhere Ringzahl gewinnt (A)", () => {
    expect(determineFinaleRoundWinner(97, 95)).toBe("A")
  })

  it("höhere Ringzahl gewinnt (B)", () => {
    expect(determineFinaleRoundWinner(94, 96)).toBe("B")
  })

  it("gleiche Ringzahl → DRAW (Verlängerung nötig)", () => {
    expect(determineFinaleRoundWinner(95, 95)).toBe("DRAW")
  })
})

// ─── determinePlayoffDuelWinner ──────────────────────────────────────────────

describe("determinePlayoffDuelWinner", () => {
  it("niedrigerer Ringteiler gewinnt (A)", () => {
    expect(determinePlayoffDuelWinner(5.0, 95, 0, 6.0, 94, 0)).toBe("A")
  })

  it("niedrigerer Ringteiler gewinnt (B)", () => {
    expect(determinePlayoffDuelWinner(6.0, 94, 0, 5.0, 95, 0)).toBe("B")
  })

  it("Gleichstand Ringteiler: höhere Seriensumme gewinnt (A)", () => {
    // RT gleich, aber A hat mehr Ringe
    expect(determinePlayoffDuelWinner(5.0, 96, 1, 5.0, 95, 0)).toBe("A")
  })

  it("Gleichstand Ringteiler: höhere Seriensumme gewinnt (B)", () => {
    expect(determinePlayoffDuelWinner(5.0, 95, 0, 5.0, 96, 1)).toBe("B")
  })

  it("Gleichstand Ringteiler + Seriensumme: kleinerer Teiler gewinnt (A)", () => {
    expect(determinePlayoffDuelWinner(5.0, 95, 0, 5.0, 95, 1)).toBe("A")
  })

  it("Gleichstand Ringteiler + Seriensumme: kleinerer Teiler gewinnt (B)", () => {
    expect(determinePlayoffDuelWinner(5.0, 95, 1, 5.0, 95, 0)).toBe("B")
  })

  it("absoluter Gleichstand → DRAW", () => {
    expect(determinePlayoffDuelWinner(5.0, 95, 0, 5.0, 95, 0)).toBe("DRAW")
  })
})

// ─── isPlayoffMatchComplete ──────────────────────────────────────────────────

describe("isPlayoffMatchComplete", () => {
  it("VF: noch nicht abgeschlossen bei 2:2", () => {
    expect(isPlayoffMatchComplete(2, 2, "QUARTER_FINAL")).toBe(false)
  })

  it("VF: abgeschlossen wenn A 3 Siege", () => {
    expect(isPlayoffMatchComplete(3, 2, "QUARTER_FINAL")).toBe(true)
  })

  it("VF: abgeschlossen wenn B 3 Siege", () => {
    expect(isPlayoffMatchComplete(1, 3, "QUARTER_FINAL")).toBe(true)
  })

  it("HF: noch nicht abgeschlossen bei 2:1", () => {
    expect(isPlayoffMatchComplete(2, 1, "SEMI_FINAL")).toBe(false)
  })

  it("HF: abgeschlossen wenn A 3 Siege", () => {
    expect(isPlayoffMatchComplete(3, 0, "SEMI_FINAL")).toBe(true)
  })

  it("Finale: bereits nach 1 Sieg abgeschlossen (A)", () => {
    expect(isPlayoffMatchComplete(1, 0, "FINAL")).toBe(true)
  })

  it("Finale: bereits nach 1 Sieg abgeschlossen (B)", () => {
    expect(isPlayoffMatchComplete(0, 1, "FINAL")).toBe(true)
  })

  it("Finale: noch offen bei 0:0", () => {
    expect(isPlayoffMatchComplete(0, 0, "FINAL")).toBe(false)
  })
})

// ─── createFirstRoundMatchups ────────────────────────────────────────────────

describe("createFirstRoundMatchups", () => {
  it("4 Teilnehmer → SEMI_FINAL (1v4, 2v3)", () => {
    const standings = makeStandings(["p1", "p2", "p3", "p4"])
    const result = createFirstRoundMatchups(standings)
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({
      participantAId: "p1",
      participantBId: "p4",
      round: "SEMI_FINAL",
    })
    expect(result[1]).toMatchObject({
      participantAId: "p2",
      participantBId: "p3",
      round: "SEMI_FINAL",
    })
  })

  it("7 Teilnehmer → SEMI_FINAL (Top4: 1v4, 2v3)", () => {
    const standings = makeStandings(["p1", "p2", "p3", "p4", "p5", "p6", "p7"])
    const result = createFirstRoundMatchups(standings)
    expect(result).toHaveLength(2)
    expect(result.every((m) => m.round === "SEMI_FINAL")).toBe(true)
    expect(result[0]).toMatchObject({ participantAId: "p1", participantBId: "p4" })
    expect(result[1]).toMatchObject({ participantAId: "p2", participantBId: "p3" })
  })

  it("8 Teilnehmer → QUARTER_FINAL (1v8, 2v7, 3v6, 4v5)", () => {
    const standings = makeStandings(["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"])
    const result = createFirstRoundMatchups(standings)
    expect(result).toHaveLength(4)
    expect(result.every((m) => m.round === "QUARTER_FINAL")).toBe(true)
    expect(result[0]).toMatchObject({ participantAId: "p1", participantBId: "p8" })
    expect(result[1]).toMatchObject({ participantAId: "p2", participantBId: "p7" })
    expect(result[2]).toMatchObject({ participantAId: "p3", participantBId: "p6" })
    expect(result[3]).toMatchObject({ participantAId: "p4", participantBId: "p5" })
  })

  it("10 Teilnehmer → QUARTER_FINAL (nur Top8)", () => {
    const standings = makeStandings(["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9", "p10"])
    const result = createFirstRoundMatchups(standings)
    expect(result).toHaveLength(4)
    // p9 und p10 nicht dabei
    const allIds = result.flatMap((m) => [m.participantAId, m.participantBId])
    expect(allIds).not.toContain("p9")
    expect(allIds).not.toContain("p10")
  })

  it("Zurückgezogene Teilnehmer werden ausgeschlossen", () => {
    // p1 ist zurückgezogen → p2, p3, p4, p5 qualifizieren sich für SEMI_FINAL
    const standings = makeStandings(["p1", "p2", "p3", "p4", "p5"], ["p1"])
    const result = createFirstRoundMatchups(standings)
    expect(result).toHaveLength(2)
    expect(result.every((m) => m.round === "SEMI_FINAL")).toBe(true)
    const allIds = result.flatMap((m) => [m.participantAId, m.participantBId])
    expect(allIds).not.toContain("p1")
    expect(allIds).toContain("p2")
    expect(allIds).toContain("p5")
  })
})

// ─── createNextRoundMatchups ─────────────────────────────────────────────────

describe("createNextRoundMatchups", () => {
  it("normales Szenario: Re-Seeding nach Original-Rang", () => {
    // VF-Gewinner: p1, p2, p3, p4 (alle nach Gruppenrang)
    const rankMap = new Map([
      ["p1", 1],
      ["p2", 2],
      ["p3", 3],
      ["p4", 4],
    ])
    const result = createNextRoundMatchups(["p1", "p2", "p3", "p4"], rankMap)
    expect(result).toHaveLength(2)
    // Bester (p1) vs. Schlechtester (p4)
    expect(result[0]).toMatchObject({ participantAId: "p1", participantBId: "p4" })
    // Zweiter (p2) vs. Dritter (p3)
    expect(result[1]).toMatchObject({ participantAId: "p2", participantBId: "p3" })
  })

  it("Upset-Szenario: p8 schlägt p1 → p8 bekommt schlechtesten HF-Platz", () => {
    // VF-Gewinner: p8 (upset), p2, p3, p4
    const rankMap = new Map([
      ["p8", 8],
      ["p2", 2],
      ["p3", 3],
      ["p4", 4],
    ])
    const result = createNextRoundMatchups(["p8", "p2", "p3", "p4"], rankMap)
    // Sortiert nach Rang: p2(2), p3(3), p4(4), p8(8)
    expect(result[0]).toMatchObject({ participantAId: "p2", participantBId: "p8" })
    expect(result[1]).toMatchObject({ participantAId: "p3", participantBId: "p4" })
  })
})

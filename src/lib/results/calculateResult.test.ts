import { describe, it, expect } from "vitest"
import { calcRingteiler, determineOutcome, MAX_RINGS } from "./calculateResult"

describe("MAX_RINGS", () => {
  it("WHOLE hat Maximalringe 100", () => {
    expect(MAX_RINGS.WHOLE).toBe(100)
  })
  it("DECIMAL hat Maximalringe 109", () => {
    expect(MAX_RINGS.DECIMAL).toBe(109)
  })
})

describe("calcRingteiler", () => {
  it("berechnet Ringteiler korrekt für Ganzring (Beispiel aus features.md: A)", () => {
    // 96 Ringe, Teiler 3.7 → RT 7.7
    expect(calcRingteiler(100, 96, 3.7)).toBeCloseTo(7.7)
  })

  it("berechnet Ringteiler korrekt für Ganzring (Beispiel aus features.md: B)", () => {
    // 96 Ringe, Teiler 4.2 → RT 8.2
    expect(calcRingteiler(100, 96, 4.2)).toBeCloseTo(8.2)
  })

  it("berechnet Ringteiler korrekt für Zehntelring (Beispiel aus features.md: A)", () => {
    // 104.5 Ringe, Teiler 2.1 → RT 6.6
    expect(calcRingteiler(109, 104.5, 2.1)).toBeCloseTo(6.6)
  })

  it("berechnet Ringteiler korrekt für Zehntelring (Beispiel aus features.md: B)", () => {
    // 105.0 Ringe, Teiler 1.8 → RT 5.8
    expect(calcRingteiler(109, 105.0, 1.8)).toBeCloseTo(5.8)
  })

  it("niedrigerer Ringteiler bei besserem Schützen", () => {
    const a = calcRingteiler(100, 96, 3.7)
    const b = calcRingteiler(100, 96, 4.2)
    expect(a).toBeLessThan(b)
  })
})

describe("determineOutcome", () => {
  it("HOME_WIN wenn Heim niedrigeren Ringteiler hat", () => {
    const home = { totalRings: 96, teiler: 3.7, ringteiler: 7.7 }
    const away = { totalRings: 96, teiler: 4.2, ringteiler: 8.2 }
    expect(determineOutcome(home, away)).toBe("HOME_WIN")
  })

  it("AWAY_WIN wenn Gast niedrigeren Ringteiler hat", () => {
    const home = { totalRings: 104.5, teiler: 2.1, ringteiler: 6.6 }
    const away = { totalRings: 105.0, teiler: 1.8, ringteiler: 5.8 }
    expect(determineOutcome(home, away)).toBe("AWAY_WIN")
  })

  it("Tiebreak 1: höhere Seriensumme gewinnt bei gleichem Ringteiler", () => {
    // Gleicher RT (z.B. 10.0), aber home hat mehr Ringe
    const home = { totalRings: 95, teiler: 5.0, ringteiler: 10.0 }
    const away = { totalRings: 93, teiler: 7.0, ringteiler: 10.0 } // RT 109-93+7=23? nein - Zahlen angepasst für Test
    // Wir testen nur die determineOutcome-Logik (Ringteiler schon berechnet übergeben)
    expect(determineOutcome(home, away)).toBe("HOME_WIN")
  })

  it("Tiebreak 2: kleinerer Teiler gewinnt wenn Ringe und RT gleich", () => {
    const home = { totalRings: 95, teiler: 4.0, ringteiler: 10.0 }
    const away = { totalRings: 95, teiler: 5.0, ringteiler: 10.0 }
    expect(determineOutcome(home, away)).toBe("HOME_WIN")
  })

  it("DRAW wenn alle Werte identisch", () => {
    const result = { totalRings: 95, teiler: 5.0, ringteiler: 10.0 }
    expect(determineOutcome(result, result)).toBe("DRAW")
  })

  it("Tiebreak: Gast gewinnt bei höherer Serie", () => {
    const home = { totalRings: 90, teiler: 10.0, ringteiler: 20.0 }
    const away = { totalRings: 92, teiler: 12.0, ringteiler: 20.0 }
    expect(determineOutcome(home, away)).toBe("AWAY_WIN")
  })

  it("Tiebreak: Gast gewinnt bei kleinerem Teiler (gleiche Ringe, gleicher RT)", () => {
    const home = { totalRings: 95, teiler: 6.0, ringteiler: 11.0 }
    const away = { totalRings: 95, teiler: 5.0, ringteiler: 11.0 }
    expect(determineOutcome(home, away)).toBe("AWAY_WIN")
  })
})

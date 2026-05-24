import { describe, expect, it } from "vitest"
import { buildStarterListRows } from "@/lib/pdf/eventStarterList"

type CP = Parameters<typeof buildStarterListRows>[0]["participants"][number]

function makeCp(opts: Partial<CP> & { lastName: string; firstName: string }): CP {
  return {
    status: "ACTIVE",
    participant: { firstName: opts.firstName, lastName: opts.lastName },
    discipline: opts.discipline ?? null,
    ...opts,
  } as CP
}

describe("buildStarterListRows", () => {
  it("excludes WITHDRAWN participants", () => {
    const rows = buildStarterListRows({
      participants: [
        makeCp({ firstName: "A", lastName: "Active" }),
        makeCp({ firstName: "W", lastName: "Withdrawn", status: "WITHDRAWN" }),
      ],
      competitionDisciplineName: "Luftpistole",
      random: () => 0,
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].lastName).toBe("Active")
  })

  it("assigns unique start numbers 1..n", () => {
    const rows = buildStarterListRows({
      participants: [
        makeCp({ firstName: "A", lastName: "One" }),
        makeCp({ firstName: "B", lastName: "Two" }),
        makeCp({ firstName: "C", lastName: "Three" }),
      ],
      competitionDisciplineName: "Luftpistole",
      random: () => 0,
    })
    const nrs = rows.map((r) => r.nr).sort((a, b) => a - b)
    expect(nrs).toEqual([1, 2, 3])
  })

  it("with deterministic random=()=>0 produces specific order (Fisher–Yates property)", () => {
    // Fisher–Yates with random()=0 always swaps with index 0
    // Starting [One, Two, Three]:
    // i=2: swap(0,2) → [Three, Two, One]
    // i=1: swap(0,1) → [Two, Three, One]
    const rows = buildStarterListRows({
      participants: [
        makeCp({ firstName: "A", lastName: "One" }),
        makeCp({ firstName: "B", lastName: "Two" }),
        makeCp({ firstName: "C", lastName: "Three" }),
      ],
      competitionDisciplineName: "Luftpistole",
      random: () => 0,
    })
    expect(rows.map((r) => r.lastName)).toEqual(["Two", "Three", "One"])
  })

  it("uses participant discipline when set (mixed event)", () => {
    const rows = buildStarterListRows({
      participants: [
        makeCp({
          firstName: "A",
          lastName: "Mix",
          discipline: { name: "Luftgewehr" },
        }),
      ],
      competitionDisciplineName: null,
      random: () => 0,
    })
    expect(rows[0].disciplineName).toBe("Luftgewehr")
  })

  it("falls back to competition discipline when participant has none (fixed event)", () => {
    const rows = buildStarterListRows({
      participants: [makeCp({ firstName: "A", lastName: "Fix", discipline: null })],
      competitionDisciplineName: "Luftpistole",
      random: () => 0,
    })
    expect(rows[0].disciplineName).toBe("Luftpistole")
  })

  it("returns null disciplineName when neither participant nor competition has one", () => {
    const rows = buildStarterListRows({
      participants: [makeCp({ firstName: "A", lastName: "None", discipline: null })],
      competitionDisciplineName: null,
      random: () => 0,
    })
    expect(rows[0].disciplineName).toBeNull()
  })

  it("returns empty array when there are no ACTIVE participants", () => {
    const rows = buildStarterListRows({
      participants: [
        makeCp({ firstName: "W", lastName: "Out", status: "WITHDRAWN" }),
      ],
      competitionDisciplineName: "Luftpistole",
      random: () => 0,
    })
    expect(rows).toEqual([])
  })
})

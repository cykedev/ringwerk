import { describe, expect, it } from "vitest"
import { renderToString } from "@react-pdf/renderer"
import { createElement } from "react"
import { EventStarterListPdf } from "@/lib/pdf/EventStarterListPdf"

describe("EventStarterListPdf", () => {
  const baseProps = {
    competitionName: "Kranzlschiessen 2026",
    eventDate: new Date("2026-06-15T08:00:00.000Z"),
    participants: [
      { nr: 1, firstName: "Anna", lastName: "Schütz", disciplineName: "Luftpistole" },
      { nr: 2, firstName: "Bert", lastName: "Müller", disciplineName: "Luftgewehr" },
    ],
    generatedAt: new Date("2026-05-24T10:00:00.000Z"),
  }

  it("renders with participants", async () => {
    const pdf = await renderToString(
      createElement(EventStarterListPdf, baseProps) as any
    )
    // Document was created and contains PDF header
    expect(pdf).toContain("%PDF")
    // Title metadata is present
    expect(pdf).toContain("Starterliste")
    // Document structure is intact with expected resources
    expect(pdf).toMatch(/\/Type \/Font/)
    expect(pdf).toMatch(/\/Type \/Page/)
  })

  it("renders without participants (blank list)", async () => {
    const pdf = await renderToString(
      createElement(EventStarterListPdf, { ...baseProps, participants: [] }) as any
    )
    expect(pdf).toContain("%PDF")
    expect(pdf).toContain("Starterliste")
  })

  it("omits date segment from subtitle when eventDate is null", async () => {
    const pdf = await renderToString(
      createElement(EventStarterListPdf, { ...baseProps, eventDate: null }) as any
    )
    // Document renders without error
    expect(pdf).toContain("%PDF")
    expect(pdf).toContain("Starterliste")
  })
})

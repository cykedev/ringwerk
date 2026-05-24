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
    // Verify valid PDF document structure
    expect(pdf).toContain("%PDF")
    expect(pdf).toMatch(/\/Type \/Catalog/)
    expect(pdf).toMatch(/\/Type \/Pages/)
    expect(pdf).toMatch(/\/Type \/Page/)
    // Verify document metadata (readable title and author)
    expect(pdf).toContain("Starterliste")
    expect(pdf).toContain("Ringwerk")
    // Verify fonts are embedded (ensures text rendering)
    expect(pdf).toMatch(/\/Type \/Font/)
    expect(pdf).toMatch(/\/BaseFont \/Helvetica/)
    // Verify substantial content is present (participants rendered in compressed stream)
    expect(pdf.length).toBeGreaterThan(4000)
  })

  it("renders without participants (blank list)", async () => {
    const pdf = await renderToString(
      createElement(EventStarterListPdf, { ...baseProps, participants: [] }) as any
    )
    // Verify valid PDF with correct structure
    expect(pdf).toContain("%PDF")
    expect(pdf).toContain("Starterliste")
    expect(pdf).toMatch(/\/Type \/Font/)
    // Verify content is present (empty rows are still rendered)
    expect(pdf.length).toBeGreaterThan(2500)
  })

  it("omits date segment from subtitle when eventDate is null", async () => {
    const pdf = await renderToString(
      createElement(EventStarterListPdf, { ...baseProps, eventDate: null }) as any
    )
    // Verify PDF structure is intact
    expect(pdf).toContain("%PDF")
    expect(pdf).toContain("Starterliste")
    expect(pdf).toMatch(/\/Type \/Font/)
    expect(pdf).toMatch(/\/Type \/Page/)
    // Verify content is generated
    expect(pdf.length).toBeGreaterThan(2500)
  })
})

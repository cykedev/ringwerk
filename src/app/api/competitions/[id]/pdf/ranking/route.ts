import { type NextRequest, NextResponse } from "next/server"
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer"
import { createElement, type ReactElement } from "react"
import { getAuthSession } from "@/lib/auth-helpers"
import { getEventWithSeries } from "@/lib/competitions/queries"
import { rankEventParticipants } from "@/lib/scoring/rankEventParticipants"
import { EventRankingPdf } from "@/lib/pdf/EventRankingPdf"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await getAuthSession()
  if (!session) {
    return new NextResponse("Nicht angemeldet", { status: 401 })
  }

  const { id } = await params

  const data = await getEventWithSeries(id)
  if (!data) {
    return new NextResponse("Wettbewerb nicht gefunden", { status: 404 })
  }

  const { competition, series } = data

  const ranked = rankEventParticipants(series, {
    scoringMode: competition.scoringMode,
    targetValue: competition.targetValue,
    targetValueType: competition.targetValueType,
    discipline: competition.discipline,
  })

  const element = createElement(EventRankingPdf, {
    competitionName: competition.name,
    disciplineName: competition.discipline?.name ?? null,
    eventDate: competition.eventDate,
    scoringMode: competition.scoringMode,
    shotsPerSeries: competition.shotsPerSeries,
    targetValue: competition.targetValue,
    isMixed: !competition.disciplineId,
    entries: ranked,
    generatedAt: new Date(),
  }) as ReactElement<DocumentProps>

  const buffer = await renderToBuffer(element)

  const slug = competition.name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
  const filename = `rangliste-${slug}.pdf`

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
}

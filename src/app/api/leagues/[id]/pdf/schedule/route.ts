import { type NextRequest, NextResponse } from "next/server"
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer"
import { createElement, type ReactElement } from "react"
import { getAuthSession } from "@/lib/auth-helpers"
import { getLeagueById } from "@/lib/leagues/queries"
import { getMatchupsForLeague } from "@/lib/matchups/queries"
import { getStandingsForLeague } from "@/lib/standings/queries"
import { SchedulePdf } from "@/lib/pdf/SchedulePdf"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await getAuthSession()
  if (!session) {
    return new NextResponse("Nicht angemeldet", { status: 401 })
  }

  const { id } = await params

  const [league, standings, matchups] = await Promise.all([
    getLeagueById(id),
    getStandingsForLeague(id),
    getMatchupsForLeague(id),
  ])

  if (!league) {
    return new NextResponse("Liga nicht gefunden", { status: 404 })
  }

  const element = createElement(SchedulePdf, {
    leagueName: league.name,
    disciplineName: league.discipline.name,
    standings,
    matchups,
    firstLegDeadline: league.firstLegDeadline,
    secondLegDeadline: league.secondLegDeadline,
    generatedAt: new Date(),
  }) as ReactElement<DocumentProps>

  const buffer = await renderToBuffer(element)

  const slug = league.name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
  const filename = `spielplan-${slug}.pdf`

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
}

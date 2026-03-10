import { type NextRequest, NextResponse } from "next/server"
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer"
import { createElement, type ReactElement } from "react"
import { getAuthSession } from "@/lib/auth-helpers"
import { getLeagueById } from "@/lib/leagues/queries"
import { getPlayoffBracket } from "@/lib/playoffs/queries"
import { PlayoffsPdf } from "@/lib/pdf/PlayoffsPdf"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await getAuthSession()
  if (!session) {
    return new NextResponse("Nicht angemeldet", { status: 401 })
  }

  const { id } = await params

  const [league, bracket] = await Promise.all([getLeagueById(id), getPlayoffBracket(id)])

  if (!league) {
    return new NextResponse("Liga nicht gefunden", { status: 404 })
  }

  const playoffsStarted =
    bracket.quarterFinals.length + bracket.semiFinals.length > 0 || bracket.final !== null

  if (!playoffsStarted) {
    return new NextResponse("Playoffs noch nicht gestartet", { status: 404 })
  }

  const element = createElement(PlayoffsPdf, {
    leagueName: league.name,
    disciplineName: league.discipline.name,
    bracket,
    generatedAt: new Date(),
  }) as ReactElement<DocumentProps>

  const buffer = await renderToBuffer(element)

  const slug = league.name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
  const filename = `playoffs-${slug}.pdf`

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
}

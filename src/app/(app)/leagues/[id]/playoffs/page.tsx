import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft, CalendarDays, BarChart2, Trophy } from "lucide-react"
import { getAuthSession } from "@/lib/auth-helpers"
import { getLeagueById } from "@/lib/leagues/queries"
import { getPlayoffBracket } from "@/lib/playoffs/queries"
import { getStandingsForLeague } from "@/lib/standings/queries"
import { db } from "@/lib/db"
import { PlayoffBracket } from "@/components/app/playoffs/PlayoffBracket"
import { StartPlayoffsButton } from "@/components/app/playoffs/StartPlayoffsButton"
import { Button } from "@/components/ui/button"

interface Props {
  params: Promise<{ id: string }>
}

export default async function LeaguePlayoffsPage({ params }: Props) {
  const { id } = await params

  const session = await getAuthSession()
  if (!session) redirect("/login")

  const [league, bracket, standings, pendingCount] = await Promise.all([
    getLeagueById(id),
    getPlayoffBracket(id),
    getStandingsForLeague(id),
    db.matchup.count({ where: { leagueId: id, status: "PENDING" } }),
  ])

  if (!league) notFound()

  const isAdmin = session.user.role === "ADMIN"
  const playoffsStarted =
    bracket.quarterFinals.length + bracket.semiFinals.length > 0 || bracket.final !== null

  const activeCount = standings.filter((r) => !r.withdrawn).length
  const canStart = activeCount >= 4 && pendingCount === 0

  let disabledReason: string | undefined
  if (activeCount < 4) {
    disabledReason = "Mindestens 4 aktive Teilnehmer erforderlich."
  } else if (pendingCount > 0) {
    disabledReason = `Noch ${pendingCount} ausstehende Paarung${pendingCount !== 1 ? "en" : ""} in der Gruppenphase.`
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      {/* Header */}
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
          <Link href="/leagues">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Ligen
          </Link>
        </Button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{league.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {league.discipline.name} · Playoffs
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/leagues/${id}/standings`}>
                <BarChart2 className="mr-1 h-4 w-4" />
                Tabelle
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/leagues/${id}/schedule`}>
                <CalendarDays className="mr-1 h-4 w-4" />
                Spielplan
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Start-Button (nur Admin, wenn noch nicht gestartet) */}
      {isAdmin && !playoffsStarted && (
        <div className="rounded-lg border p-4">
          <div className="flex items-start gap-3">
            <Trophy className="mt-0.5 h-5 w-5 text-muted-foreground" />
            <div className="flex-1 space-y-3">
              <div>
                <p className="text-sm font-medium">Playoffs noch nicht gestartet</p>
                <p className="text-sm text-muted-foreground">
                  {activeCount < 4
                    ? "Zu wenige aktive Teilnehmer für Playoffs."
                    : activeCount >= 8
                      ? `Top 8 von ${activeCount} Teilnehmern qualifizieren sich für das Viertelfinale.`
                      : `Top 4 von ${activeCount} Teilnehmern qualifizieren sich für das Halbfinale.`}
                </p>
              </div>
              <StartPlayoffsButton
                leagueId={id}
                disabled={!canStart}
                disabledReason={disabledReason}
              />
            </div>
          </div>
        </div>
      )}

      {/* Bracket */}
      {playoffsStarted ? (
        <PlayoffBracket bracket={bracket} isAdmin={isAdmin} />
      ) : (
        !isAdmin && (
          <p className="text-sm text-muted-foreground">Die Playoffs wurden noch nicht gestartet.</p>
        )
      )}
    </div>
  )
}

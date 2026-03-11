import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft, Trophy, Users } from "lucide-react"
import { getAuthSession } from "@/lib/auth-helpers"
import { getLeagueById } from "@/lib/leagues/queries"
import { getMatchupsForLeague, getScheduleStatus } from "@/lib/matchups/queries"
import { hasPlayoffsStarted } from "@/lib/playoffs/queries"
import { getStandingsForLeague } from "@/lib/standings/queries"
import { GenerateScheduleButton } from "@/components/app/matchups/GenerateScheduleButton"
import { ScheduleView } from "@/components/app/matchups/ScheduleView"
import { StandingsTable } from "@/components/app/standings/StandingsTable"
import { PdfDownloadButton } from "@/components/app/shared/PdfDownloadButton"
import { Button } from "@/components/ui/button"

interface Props {
  params: Promise<{ id: string }>
}

export default async function LeagueSchedulePage({ params }: Props) {
  const { id } = await params

  const [session, league, matchups, scheduleStatus, playoffsStarted, standings] = await Promise.all(
    [
      getAuthSession(),
      getLeagueById(id),
      getMatchupsForLeague(id),
      getScheduleStatus(id),
      hasPlayoffsStarted(id),
      getStandingsForLeague(id),
    ]
  )

  if (!session) redirect("/login")
  if (!league) notFound()

  const isAdmin = session.user.role === "ADMIN"

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
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
              {league.discipline.name} · Spielplan & Tabelle
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {isAdmin && (
              <Button asChild variant="outline" size="icon" className="h-9 w-9">
                <Link href={`/leagues/${id}/participants`} title="Teilnehmer">
                  <Users className="h-4 w-4" />
                </Link>
              </Button>
            )}
            <Button asChild variant="outline" size="icon" className="h-9 w-9">
              <Link href={`/leagues/${id}/playoffs`} title="Playoffs">
                <Trophy className="h-4 w-4" />
              </Link>
            </Button>
            {scheduleStatus.hasSchedule && (
              <PdfDownloadButton href={`/api/leagues/${id}/pdf/schedule`} />
            )}
            {isAdmin && league.status === "ACTIVE" && !scheduleStatus.hasSchedule && (
              <GenerateScheduleButton leagueId={id} hasSchedule={scheduleStatus.hasSchedule} />
            )}
          </div>
        </div>
      </div>

      {/* Hinweis bei abgeschlossenen Paarungen */}
      {isAdmin && scheduleStatus.hasCompletedMatchups && league.status === "ACTIVE" && (
        <p className="text-sm text-muted-foreground">
          Der Spielplan kann nicht mehr neu generiert werden, da bereits{" "}
          {scheduleStatus.totalMatchups} Paarung(en) abgeschlossen sind.
        </p>
      )}

      {/* Spielplan */}
      <ScheduleView
        matchups={matchups}
        firstLegDeadline={league.firstLegDeadline}
        secondLegDeadline={league.secondLegDeadline}
        leagueId={id}
        isAdmin={isAdmin}
        playoffsStarted={playoffsStarted}
      />

      {/* Tabelle */}
      {standings.length > 0 && (
        <div className="space-y-3 pt-2">
          <h2 className="text-base font-semibold">Tabelle</h2>
          <StandingsTable rows={standings} />
        </div>
      )}
    </div>
  )
}

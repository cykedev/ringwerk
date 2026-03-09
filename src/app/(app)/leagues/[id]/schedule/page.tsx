import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft, Users } from "lucide-react"
import { getAuthSession } from "@/lib/auth-helpers"
import { getLeagueById } from "@/lib/leagues/queries"
import { getMatchupsForLeague, getScheduleStatus } from "@/lib/matchups/queries"
import { GenerateScheduleButton } from "@/components/app/matchups/GenerateScheduleButton"
import { ScheduleView } from "@/components/app/matchups/ScheduleView"
import { Button } from "@/components/ui/button"

interface Props {
  params: Promise<{ id: string }>
}

export default async function LeagueSchedulePage({ params }: Props) {
  const { id } = await params

  const [session, league, matchups, scheduleStatus] = await Promise.all([
    getAuthSession(),
    getLeagueById(id),
    getMatchupsForLeague(id),
    getScheduleStatus(id),
  ])

  if (session?.user.role !== "ADMIN") redirect("/")
  if (!league) notFound()

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
              {league.discipline.name} · Spielplan
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/leagues/${id}/participants`}>
                <Users className="mr-1 h-4 w-4" />
                Teilnehmer
              </Link>
            </Button>
            {league.status === "ACTIVE" && !scheduleStatus.hasCompletedMatchups && (
              <GenerateScheduleButton leagueId={id} hasSchedule={scheduleStatus.hasSchedule} />
            )}
          </div>
        </div>
      </div>

      {/* Hinweis bei abgeschlossenen Paarungen */}
      {scheduleStatus.hasCompletedMatchups && league.status === "ACTIVE" && (
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
      />
    </div>
  )
}

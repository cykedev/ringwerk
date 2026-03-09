import Link from "next/link"
import { redirect } from "next/navigation"
import { BarChart2, CalendarDays } from "lucide-react"
import { getAuthSession } from "@/lib/auth-helpers"
import { getLeaguesForManagement } from "@/lib/leagues/queries"
import { getStandingsForLeague } from "@/lib/standings/queries"
import { StandingsTable } from "@/components/app/standings/StandingsTable"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export default async function DashboardPage() {
  const session = await getAuthSession()
  if (!session) redirect("/login")

  const leagues = await getLeaguesForManagement()
  const active = leagues.filter((l) => l.status === "ACTIVE")

  const standingsPerLeague = await Promise.all(
    active.map(async (l) => ({
      league: l,
      standings: await getStandingsForLeague(l.id),
    }))
  )

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Aktive Ligen auf einen Blick</p>
      </div>

      {standingsPerLeague.length === 0 ? (
        <p className="rounded-lg border px-4 py-8 text-center text-sm text-muted-foreground">
          Keine aktiven Ligen vorhanden.
        </p>
      ) : (
        <div className="space-y-10">
          {standingsPerLeague.map(({ league, standings }) => (
            <div key={league.id} className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold">{league.name}</h2>
                  <Badge variant="secondary" className="text-xs">
                    {league.discipline.name}
                  </Badge>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/leagues/${league.id}/schedule`}>
                      <CalendarDays className="mr-1 h-4 w-4" />
                      Spielplan
                    </Link>
                  </Button>
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/leagues/${league.id}/standings`}>
                      <BarChart2 className="mr-1 h-4 w-4" />
                      Tabelle
                    </Link>
                  </Button>
                </div>
              </div>
              <StandingsTable rows={standings} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

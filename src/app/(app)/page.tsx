import Link from "next/link"
import { redirect } from "next/navigation"
import { Trophy } from "lucide-react"
import { getAuthSession } from "@/lib/auth-helpers"
import { getLeaguesForManagement } from "@/lib/leagues/queries"
import { getStandingsForLeague } from "@/lib/standings/queries"
import { getPlayoffBracket } from "@/lib/playoffs/queries"
import { StandingsTable } from "@/components/app/standings/StandingsTable"
import { PlayoffBracket } from "@/components/app/playoffs/PlayoffBracket"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

// ─── DashboardPage ───────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const session = await getAuthSession()
  if (!session) redirect("/login")

  const leagues = await getLeaguesForManagement()
  const active = leagues.filter((l) => l.status === "ACTIVE")

  const dataPerLeague = await Promise.all(
    active.map(async (l) => ({
      league: l,
      standings: await getStandingsForLeague(l.id),
      bracket: await getPlayoffBracket(l.id),
    }))
  )

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Aktive Ligen auf einen Blick</p>
      </div>

      {dataPerLeague.length === 0 ? (
        <p className="rounded-lg border px-4 py-8 text-center text-sm text-muted-foreground">
          Keine aktiven Ligen vorhanden.
        </p>
      ) : (
        <div className="space-y-10">
          {dataPerLeague.map(({ league, standings, bracket }) => {
            const playoffsStarted =
              bracket.quarterFinals.length + bracket.semiFinals.length > 0 || bracket.final !== null

            return (
              <div key={league.id} className="space-y-3">
                {/* Liga-Titel */}
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold">{league.name}</h2>
                  <Badge variant="secondary" className="text-xs">
                    {league.discipline.name}
                  </Badge>
                </div>

                {/* Inhalt: Playoffs → nur Bracket; davor → Tabelle */}
                {playoffsStarted ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-sm font-semibold">
                      <Trophy className="h-4 w-4 text-muted-foreground" />
                      Playoffs
                    </div>
                    <PlayoffBracket bracket={bracket} isAdmin={false} compact={true} />
                    <div className="flex justify-end">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/leagues/${league.id}/playoffs`}>Details →</Link>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <StandingsTable rows={standings} />
                    <div className="flex justify-end">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/leagues/${league.id}/schedule`}>Details →</Link>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

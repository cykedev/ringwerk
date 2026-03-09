import Link from "next/link"
import { redirect } from "next/navigation"
import { Plus, Archive, BarChart2, CalendarDays, CheckCircle, Trophy, Users } from "lucide-react"
import { getAuthSession } from "@/lib/auth-helpers"
import { getLeaguesForManagement } from "@/lib/leagues/queries"
import { LeagueActions } from "@/components/app/leagues/LeagueActions"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { getDisplayTimeZone, formatDateOnly } from "@/lib/dateTime"

function formatDate(date: Date | null, tz: string): string {
  if (!date) return "—"
  return formatDateOnly(date, tz)
}

const NAV_LINK =
  "flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"

export default async function LeaguesPage() {
  const session = await getAuthSession()
  if (!session) redirect("/login")

  const isAdmin = session.user.role === "ADMIN"
  const tz = getDisplayTimeZone()
  const leagues = await getLeaguesForManagement()

  const active = leagues.filter((l) => l.status === "ACTIVE")
  const completed = leagues.filter((l) => l.status === "COMPLETED")
  const archived = leagues.filter((l) => l.status === "ARCHIVED")

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Ligen</h1>
          <p className="mt-1 text-sm text-muted-foreground">Alle Wettbewerbe des Vereins</p>
        </div>
        {isAdmin && (
          <Button asChild size="sm">
            <Link href="/leagues/new">
              <Plus className="mr-1 h-4 w-4" />
              Neue Liga
            </Link>
          </Button>
        )}
      </div>

      {/* Aktive Ligen */}
      <div className="space-y-3">
        {active.length === 0 ? (
          <p className="rounded-lg border px-4 py-8 text-center text-sm text-muted-foreground">
            Keine aktiven Ligen vorhanden.
          </p>
        ) : (
          active.map((l) => (
            <Card key={l.id} className="transition-colors hover:bg-muted/20">
              <CardContent className="flex items-center justify-between gap-4 py-5">
                <div className="min-w-0 flex-1 space-y-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-semibold">{l.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {l.discipline.name}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    {isAdmin && (
                      <Link href={`/leagues/${l.id}/participants`} className={NAV_LINK}>
                        <Users className="h-3.5 w-3.5" />
                        {l._count.participants} Teilnehmer
                      </Link>
                    )}
                    <Link href={`/leagues/${l.id}/schedule`} className={NAV_LINK}>
                      <CalendarDays className="h-3.5 w-3.5" />
                      Spielplan
                    </Link>
                    <Link href={`/leagues/${l.id}/standings`} className={NAV_LINK}>
                      <BarChart2 className="h-3.5 w-3.5" />
                      Tabelle
                    </Link>
                    <Link href={`/leagues/${l.id}/playoffs`} className={NAV_LINK}>
                      <Trophy className="h-3.5 w-3.5" />
                      Playoffs
                    </Link>
                  </div>
                  <p className="text-xs text-muted-foreground/70">
                    Hinrunde bis {formatDate(l.firstLegDeadline, tz)} · Rückrunde bis{" "}
                    {formatDate(l.secondLegDeadline, tz)}
                  </p>
                </div>
                {isAdmin && <LeagueActions league={l} />}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Abgeschlossene Ligen */}
      {completed.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle className="h-4 w-4" />
            Abgeschlossen ({completed.length})
          </div>
          <div className="space-y-2 opacity-70">
            {completed.map((l) => (
              <Card key={l.id} className="transition-colors hover:bg-muted/20">
                <CardContent className="flex items-center justify-between gap-4 py-4">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">{l.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {l.discipline.name}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                      {isAdmin && (
                        <Link href={`/leagues/${l.id}/participants`} className={NAV_LINK}>
                          <Users className="h-3.5 w-3.5" />
                          {l._count.participants} Teilnehmer
                        </Link>
                      )}
                      <Link href={`/leagues/${l.id}/schedule`} className={NAV_LINK}>
                        <CalendarDays className="h-3.5 w-3.5" />
                        Spielplan
                      </Link>
                      <Link href={`/leagues/${l.id}/standings`} className={NAV_LINK}>
                        <BarChart2 className="h-3.5 w-3.5" />
                        Tabelle
                      </Link>
                      <Link href={`/leagues/${l.id}/playoffs`} className={NAV_LINK}>
                        <Trophy className="h-3.5 w-3.5" />
                        Playoffs
                      </Link>
                    </div>
                  </div>
                  {isAdmin && <LeagueActions league={l} />}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Archivierte Ligen */}
      {archived.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Archive className="h-4 w-4" />
            Archiviert ({archived.length})
          </div>
          <div className="space-y-2 opacity-50">
            {archived.map((l) => (
              <Card key={l.id}>
                <CardContent className="flex items-center justify-between gap-4 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm line-through">{l.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {l.discipline.name}
                    </Badge>
                  </div>
                  {isAdmin && <LeagueActions league={l} />}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

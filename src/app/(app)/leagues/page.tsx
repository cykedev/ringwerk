import Link from "next/link"
import { redirect } from "next/navigation"
import { Plus, Archive, CalendarDays, CheckCircle, Users } from "lucide-react"
import { getAuthSession } from "@/lib/auth-helpers"
import { getLeaguesForManagement } from "@/lib/leagues/queries"
import { LeagueActions } from "@/components/app/leagues/LeagueActions"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getDisplayTimeZone, formatDateOnly } from "@/lib/dateTime"

function formatDate(date: Date | null, tz: string): string {
  if (!date) return "—"
  return formatDateOnly(date, tz)
}

export default async function LeaguesPage() {
  const session = await getAuthSession()
  if (session?.user.role !== "ADMIN") redirect("/")

  const tz = getDisplayTimeZone()
  const leagues = await getLeaguesForManagement()

  const active = leagues.filter((l) => l.status === "ACTIVE")
  const completed = leagues.filter((l) => l.status === "COMPLETED")
  const archived = leagues.filter((l) => l.status === "ARCHIVED")

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Ligen</h1>
          <p className="text-sm text-muted-foreground mt-1">Alle Wettbewerbe des Vereins</p>
        </div>
        <Button asChild size="sm">
          <Link href="/leagues/new">
            <Plus className="mr-1 h-4 w-4" />
            Neue Liga
          </Link>
        </Button>
      </div>

      {/* Aktive Ligen */}
      <div className="rounded-lg border">
        {active.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            Keine aktiven Ligen vorhanden.
          </p>
        ) : (
          <div className="divide-y">
            {active.map((l) => (
              <div key={l.id} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{l.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {l.discipline.name}
                    </Badge>
                    <Link
                      href={`/leagues/${l.id}/participants`}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Users className="h-3 w-3" />
                      {l._count.participants} Teilnehmer
                    </Link>
                    <Link
                      href={`/leagues/${l.id}/schedule`}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <CalendarDays className="h-3 w-3" />
                      Spielplan
                    </Link>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    Hinrunde bis {formatDate(l.firstLegDeadline, tz)} · Rückrunde bis{" "}
                    {formatDate(l.secondLegDeadline, tz)}
                  </div>
                </div>
                <LeagueActions league={l} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Abgeschlossene Ligen */}
      {completed.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle className="h-4 w-4" />
            Abgeschlossen ({completed.length})
          </div>
          <div className="rounded-lg border opacity-75">
            <div className="divide-y">
              {completed.map((l) => (
                <div key={l.id} className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{l.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {l.discipline.name}
                      </Badge>
                      <Link
                        href={`/leagues/${l.id}/participants`}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <Users className="h-3 w-3" />
                        {l._count.participants} Teilnehmer
                      </Link>
                      <Link
                        href={`/leagues/${l.id}/schedule`}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <CalendarDays className="h-3 w-3" />
                        Spielplan
                      </Link>
                    </div>
                  </div>
                  <LeagueActions league={l} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Archivierte Ligen */}
      {archived.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Archive className="h-4 w-4" />
            Archiviert ({archived.length})
          </div>
          <div className="rounded-lg border opacity-60">
            <div className="divide-y">
              {archived.map((l) => (
                <div key={l.id} className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm line-through">{l.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {l.discipline.name}
                      </Badge>
                    </div>
                  </div>
                  <LeagueActions league={l} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

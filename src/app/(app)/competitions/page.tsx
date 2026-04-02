import Link from "next/link"
import { redirect } from "next/navigation"
import {
  Plus,
  Archive,
  CalendarDays,
  CheckCircle,
  Trophy,
  Users,
  BarChart2,
  ListOrdered,
  CalendarCheck,
} from "lucide-react"
import { getAuthSession } from "@/lib/auth-helpers"
import { getCompetitionsForManagement } from "@/lib/competitions/queries"
import { CompetitionActions } from "@/components/app/competitions/CompetitionActions"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { getDisplayTimeZone, formatDateOnly } from "@/lib/dateTime"
import type { CompetitionListItem } from "@/lib/competitions/types"

function formatDate(date: Date | null, tz: string): string {
  if (!date) return "—"
  return formatDateOnly(date, tz)
}

const NAV_LINK =
  "flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"

function CompetitionCardLinks({ c, isAdmin }: { c: CompetitionListItem; isAdmin: boolean }) {
  if (c.type === "EVENT") {
    return (
      <>
        {isAdmin && (
          <Link href={`/competitions/${c.id}/participants`} className={NAV_LINK}>
            <Users className="h-3.5 w-3.5" />
            {c._count.participants} Teilnehmer
          </Link>
        )}
        {isAdmin && (
          <Link href={`/competitions/${c.id}/series`} className={NAV_LINK}>
            <ListOrdered className="h-3.5 w-3.5" />
            Serien
          </Link>
        )}
        <Link href={`/competitions/${c.id}/ranking`} className={NAV_LINK}>
          <BarChart2 className="h-3.5 w-3.5" />
          Rangliste
        </Link>
      </>
    )
  }
  if (c.type === "SEASON") {
    return (
      <>
        {isAdmin && (
          <Link href={`/competitions/${c.id}/participants`} className={NAV_LINK}>
            <Users className="h-3.5 w-3.5" />
            {c._count.participants} Teilnehmer
          </Link>
        )}
        {isAdmin && (
          <Link href={`/competitions/${c.id}/series`} className={NAV_LINK}>
            <ListOrdered className="h-3.5 w-3.5" />
            Serien
          </Link>
        )}
        <Link href={`/competitions/${c.id}/standings`} className={NAV_LINK}>
          <BarChart2 className="h-3.5 w-3.5" />
          Rangliste
        </Link>
      </>
    )
  }
  // LEAGUE (default)
  return (
    <>
      {isAdmin && (
        <Link href={`/competitions/${c.id}/participants`} className={NAV_LINK}>
          <Users className="h-3.5 w-3.5" />
          {c._count.participants} Teilnehmer
        </Link>
      )}
      <Link href={`/competitions/${c.id}/schedule`} className={NAV_LINK}>
        <CalendarDays className="h-3.5 w-3.5" />
        Spielplan & Tabelle
      </Link>
      <Link href={`/competitions/${c.id}/playoffs`} className={NAV_LINK}>
        <Trophy className="h-3.5 w-3.5" />
        Playoffs
      </Link>
    </>
  )
}

function CompetitionCardMeta({ c, tz }: { c: CompetitionListItem; tz: string }) {
  if (c.type === "EVENT") {
    if (!c.eventDate) return null
    return (
      <p className="text-xs text-muted-foreground/70 flex items-center gap-1">
        <CalendarCheck className="h-3 w-3" />
        {formatDate(c.eventDate, tz)}
      </p>
    )
  }
  if (c.type === "SEASON") {
    if (!c.seasonStart) return null
    return (
      <p className="text-xs text-muted-foreground/70 flex items-center gap-1">
        <CalendarCheck className="h-3 w-3" />
        {formatDate(c.seasonStart, tz)}
        {c.seasonEnd && <> – {formatDate(c.seasonEnd, tz)}</>}
      </p>
    )
  }
  return (
    <p className="text-xs text-muted-foreground/70">
      Hinrunde bis {formatDate(c.hinrundeDeadline, tz)} · Rückrunde bis{" "}
      {formatDate(c.rueckrundeDeadline, tz)}
    </p>
  )
}

function CompetitionTypeBadge({ type }: { type: string }) {
  if (type === "EVENT") {
    return (
      <Badge variant="outline" className="text-xs">
        Event
      </Badge>
    )
  }
  if (type === "SEASON") {
    return (
      <Badge variant="outline" className="text-xs">
        Saison
      </Badge>
    )
  }
  return null
}

export default async function CompetitionsPage() {
  const session = await getAuthSession()
  if (!session) redirect("/login")

  const isAdmin = session.user.role === "ADMIN" || session.user.role === "MANAGER"
  const tz = getDisplayTimeZone()
  const competitions = await getCompetitionsForManagement()

  const draft = competitions.filter((c) => c.status === "DRAFT")
  const active = competitions.filter((c) => c.status === "ACTIVE")
  const completed = competitions.filter((c) => c.status === "COMPLETED")
  const archived = competitions.filter((c) => c.status === "ARCHIVED")

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Wettbewerbe</h1>
          <p className="mt-1 text-sm text-muted-foreground">Alle Wettbewerbe des Vereins</p>
        </div>
        {isAdmin && (
          <Button asChild size="sm">
            <Link href="/competitions/new">
              <Plus className="mr-1 h-4 w-4" />
              Neuer Wettbewerb
            </Link>
          </Button>
        )}
      </div>

      {/* Entwurf-Wettbewerbe */}
      {draft.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">Entwurf ({draft.length})</p>
          {draft.map((c) => (
            <Card key={c.id} className="transition-colors hover:bg-muted/20 opacity-80">
              <CardContent className="flex items-center justify-between gap-4 py-5">
                <div className="min-w-0 flex-1 space-y-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-semibold">{c.name}</span>
                    <CompetitionTypeBadge type={c.type} />
                    <Badge variant="secondary" className="text-xs">
                      {c.discipline ? c.discipline.name : "Gemischt"}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <CompetitionCardLinks c={c} isAdmin={isAdmin} />
                  </div>
                </div>
                {isAdmin && <CompetitionActions competition={c} />}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Aktive Wettbewerbe */}
      <div className="space-y-3">
        {active.length === 0 && draft.length === 0 ? (
          <p className="rounded-lg border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            Keine aktiven Wettbewerbe vorhanden.
          </p>
        ) : (
          active.map((c) => (
            <Card key={c.id} className="transition-colors hover:bg-muted/20">
              <CardContent className="flex items-center justify-between gap-4 py-5">
                <div className="min-w-0 flex-1 space-y-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-semibold">{c.name}</span>
                    <CompetitionTypeBadge type={c.type} />
                    <Badge variant="secondary" className="text-xs">
                      {c.discipline ? c.discipline.name : "Gemischt"}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <CompetitionCardLinks c={c} isAdmin={isAdmin} />
                  </div>
                  <CompetitionCardMeta c={c} tz={tz} />
                </div>
                {isAdmin && <CompetitionActions competition={c} />}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Abgeschlossene Wettbewerbe */}
      {completed.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle className="h-4 w-4" />
            Abgeschlossen ({completed.length})
          </div>
          <div className="space-y-2 opacity-70">
            {completed.map((c) => (
              <Card key={c.id} className="transition-colors hover:bg-muted/20">
                <CardContent className="flex items-center justify-between gap-4 py-4">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">{c.name}</span>
                      <CompetitionTypeBadge type={c.type} />
                      <Badge variant="secondary" className="text-xs">
                        {c.discipline ? c.discipline.name : "Gemischt"}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                      <CompetitionCardLinks c={c} isAdmin={isAdmin} />
                    </div>
                  </div>
                  {isAdmin && <CompetitionActions competition={c} />}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Archivierte Wettbewerbe */}
      {archived.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Archive className="h-4 w-4" />
            Archiviert ({archived.length})
          </div>
          <div className="space-y-2 opacity-50">
            {archived.map((c) => (
              <Card key={c.id}>
                <CardContent className="flex items-center justify-between gap-4 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm line-through">{c.name}</span>
                    <CompetitionTypeBadge type={c.type} />
                    <Badge variant="outline" className="text-xs">
                      {c.discipline ? c.discipline.name : "Gemischt"}
                    </Badge>
                  </div>
                  {isAdmin && <CompetitionActions competition={c} />}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

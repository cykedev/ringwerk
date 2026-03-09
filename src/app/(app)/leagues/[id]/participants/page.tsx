import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft, CalendarDays, UserMinus } from "lucide-react"
import { getAuthSession } from "@/lib/auth-helpers"
import { getLeagueById } from "@/lib/leagues/queries"
import { getLeagueParticipants } from "@/lib/leagueParticipants/queries"
import { getParticipantsNotInLeague } from "@/lib/participants/queries"
import { enrollParticipant } from "@/lib/leagueParticipants/actions"
import { EnrollParticipantForm } from "@/components/app/leagueParticipants/EnrollParticipantForm"
import { LeagueParticipantActions } from "@/components/app/leagueParticipants/LeagueParticipantActions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { ActionResult } from "@/lib/types"

interface Props {
  params: Promise<{ id: string }>
}

export default async function LeagueParticipantsPage({ params }: Props) {
  const { id } = await params

  const [session, league, leagueParticipants, available] = await Promise.all([
    getAuthSession(),
    getLeagueById(id),
    getLeagueParticipants(id),
    getParticipantsNotInLeague(id),
  ])

  if (session?.user.role !== "ADMIN") redirect("/")
  if (!league) notFound()

  const enrollAction = async (prevState: ActionResult | null, formData: FormData) => {
    "use server"
    return enrollParticipant(id, prevState, formData)
  }

  const activeEntries = leagueParticipants.filter((lp) => lp.status === "ACTIVE")
  const withdrawnEntries = leagueParticipants.filter((lp) => lp.status === "WITHDRAWN")

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
            <p className="text-sm text-muted-foreground mt-1">
              {league.discipline.name} · Teilnehmerverwaltung
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link href={`/leagues/${id}/schedule`}>
              <CalendarDays className="mr-1 h-4 w-4" />
              Spielplan
            </Link>
          </Button>
        </div>
      </div>

      {/* Einschreiben */}
      {league.status === "ACTIVE" && (
        <EnrollParticipantForm
          leagueId={id}
          availableParticipants={available}
          action={enrollAction}
        />
      )}

      {/* Aktive Teilnehmer */}
      <div>
        <h2 className="mb-2 text-sm font-medium">Eingeschrieben ({activeEntries.length})</h2>
        <div className="rounded-lg border">
          {activeEntries.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Noch keine Teilnehmer eingeschrieben.
            </p>
          ) : (
            <div className="divide-y">
              {activeEntries.map((lp) => (
                <div key={lp.id} className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {lp.participant.lastName}, {lp.participant.firstName}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{lp.participant.email}</p>
                  </div>
                  <LeagueParticipantActions entry={lp} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Zurückgezogene Teilnehmer */}
      {withdrawnEntries.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
            <UserMinus className="h-4 w-4" />
            Zurückgezogen ({withdrawnEntries.length})
          </div>
          <div className="rounded-lg border opacity-70">
            <div className="divide-y">
              {withdrawnEntries.map((lp) => (
                <div key={lp.id} className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm line-through text-muted-foreground">
                        {lp.participant.lastName}, {lp.participant.firstName}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        Zurückgezogen
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{lp.participant.email}</p>
                  </div>
                  <LeagueParticipantActions entry={lp} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

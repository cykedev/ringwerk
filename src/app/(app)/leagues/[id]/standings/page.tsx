import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft, CalendarDays, Users } from "lucide-react"
import { getAuthSession } from "@/lib/auth-helpers"
import { getLeagueById } from "@/lib/leagues/queries"
import { getStandingsForLeague } from "@/lib/standings/queries"
import { StandingsTable } from "@/components/app/standings/StandingsTable"
import { Button } from "@/components/ui/button"

interface Props {
  params: Promise<{ id: string }>
}

export default async function LeagueStandingsPage({ params }: Props) {
  const { id } = await params

  const session = await getAuthSession()
  if (!session) redirect("/login")

  const [league, standings] = await Promise.all([getLeagueById(id), getStandingsForLeague(id)])

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
            <p className="mt-1 text-sm text-muted-foreground">{league.discipline.name} · Tabelle</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {isAdmin && (
              <>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/leagues/${id}/participants`}>
                    <Users className="mr-1 h-4 w-4" />
                    Teilnehmer
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/leagues/${id}/schedule`}>
                    <CalendarDays className="mr-1 h-4 w-4" />
                    Spielplan
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <StandingsTable rows={standings} />
    </div>
  )
}

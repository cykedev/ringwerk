import Link from "next/link"
import { redirect } from "next/navigation"
import { Plus } from "lucide-react"
import { getAuthSession } from "@/lib/auth-helpers"
import { getParticipantsForManagement } from "@/lib/participants/queries"
import { ParticipantRowActions } from "@/components/app/participants/ParticipantRowActions"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export default async function ParticipantsPage() {
  const session = await getAuthSession()
  if (session?.user.role !== "ADMIN") redirect("/")

  const participants = await getParticipantsForManagement()
  const active = participants.filter((p) => p.isActive)
  const inactive = participants.filter((p) => !p.isActive)

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Teilnehmer</h1>
          <p className="text-sm text-muted-foreground mt-1">Alle Schützen des Vereins</p>
        </div>
        <Button asChild size="sm">
          <Link href="/participants/new">
            <Plus className="mr-1 h-4 w-4" />
            Neuer Teilnehmer
          </Link>
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        {active.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            Keine aktiven Teilnehmer vorhanden.
          </p>
        ) : (
          <div className="divide-y">
            {active.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {p.lastName}, {p.firstName}
                    </span>
                    {p._count.leagues > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {p._count.leagues} {p._count.leagues === 1 ? "Liga" : "Ligen"}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{p.contact}</p>
                </div>
                <ParticipantRowActions
                  participantId={p.id}
                  firstName={p.firstName}
                  lastName={p.lastName}
                  contact={p.contact}
                  isActive={p.isActive}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {inactive.length > 0 && (
        <div>
          <p className="mb-2 text-sm text-muted-foreground">Inaktiv ({inactive.length})</p>
          <div className="rounded-lg border bg-card opacity-60">
            <div className="divide-y">
              {inactive.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <span className="text-sm line-through text-muted-foreground">
                      {p.lastName}, {p.firstName}
                    </span>
                    <p className="text-xs text-muted-foreground">{p.contact}</p>
                  </div>
                  <ParticipantRowActions
                    participantId={p.id}
                    firstName={p.firstName}
                    lastName={p.lastName}
                    contact={p.contact}
                    isActive={p.isActive}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

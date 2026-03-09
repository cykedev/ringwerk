import { Badge } from "@/components/ui/badge"
import { formatDateOnly, getDisplayTimeZone } from "@/lib/dateTime"
import type { MatchupListItem, MatchupParticipant } from "@/lib/matchups/types"

interface Props {
  matchups: MatchupListItem[]
  firstLegDeadline: Date | null
  secondLegDeadline: Date | null
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Offen",
  COMPLETED: "Abgeschlossen",
  BYE: "Freilos",
  WALKOVER: "Kampflos",
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  PENDING: "outline",
  COMPLETED: "default",
  BYE: "secondary",
  WALKOVER: "secondary",
}

function ParticipantCell({ p }: { p: MatchupParticipant }) {
  if (p.withdrawn) {
    return (
      <span className="line-through text-muted-foreground">{`${p.lastName}, ${p.firstName}`}</span>
    )
  }
  return <>{`${p.lastName}, ${p.firstName}`}</>
}

function LegTable({
  title,
  matchups,
  deadline,
}: {
  title: string
  matchups: MatchupListItem[]
  deadline: Date | null
}) {
  const tz = getDisplayTimeZone()

  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        {deadline && (
          <span className="text-sm text-muted-foreground">
            · bis {formatDateOnly(deadline, tz)}
          </span>
        )}
      </div>

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Organisiert</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Gegner</th>
              <th className="px-4 py-2 text-right font-medium text-muted-foreground w-28">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {matchups.map((m) => {
              const isVoid = m.homeParticipant.withdrawn || m.awayParticipant?.withdrawn === true
              return (
                <tr
                  key={m.id}
                  className={`transition-colors ${isVoid ? "opacity-50" : "hover:bg-muted/20"}`}
                >
                  <td className="px-4 py-3 font-medium">
                    <ParticipantCell p={m.homeParticipant} />
                  </td>
                  <td className="px-4 py-3">
                    <ParticipantCell p={m.awayParticipant!} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Badge variant={STATUS_VARIANT[m.status]}>
                      {STATUS_LABEL[m.status] ?? m.status}
                    </Badge>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function ScheduleView({ matchups, firstLegDeadline, secondLegDeadline }: Props) {
  if (matchups.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Noch kein Spielplan generiert.
      </p>
    )
  }

  const firstLeg = matchups
    .filter((m) => m.round === "FIRST_LEG" && m.awayParticipant !== null)
    .sort((a, b) => a.roundIndex - b.roundIndex)

  const secondLeg = matchups
    .filter((m) => m.round === "SECOND_LEG" && m.awayParticipant !== null)
    .sort((a, b) => a.roundIndex - b.roundIndex)

  return (
    <div className="space-y-8">
      {firstLeg.length > 0 && (
        <LegTable title="Hinrunde" matchups={firstLeg} deadline={firstLegDeadline} />
      )}
      {secondLeg.length > 0 && (
        <LegTable title="Rückrunde" matchups={secondLeg} deadline={secondLegDeadline} />
      )}
    </div>
  )
}

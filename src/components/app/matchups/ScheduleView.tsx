import { formatDateOnly, getDisplayTimeZone } from "@/lib/dateTime"
import { determineOutcome } from "@/lib/results/calculateResult"
import type { MatchupListItem, MatchupParticipant, MatchResultSummary } from "@/lib/matchups/types"
import { ResultEntryDialog } from "@/components/app/results/ResultEntryDialog"

interface Props {
  matchups: MatchupListItem[]
  firstLegDeadline: Date | null
  secondLegDeadline: Date | null
  leagueId: string
  /** Nur ADMIN darf Ergebnisse eintragen */
  isAdmin: boolean
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Offen",
  COMPLETED: "Abgeschlossen",
  BYE: "Freilos",
  WALKOVER: "Kampflos",
}

function participantName(p: MatchupParticipant): string {
  return `${p.lastName}, ${p.firstName}`
}

/** Zeigt Name + Ergebnis-Zeile für einen Teilnehmer */
function ParticipantResult({
  participant,
  result,
}: {
  participant: MatchupParticipant
  result: MatchResultSummary | undefined
}) {
  const name = participantName(participant)
  const isWithdrawn = participant.withdrawn

  if (isWithdrawn) {
    return (
      <div>
        <span className="line-through text-muted-foreground">{name}</span>
      </div>
    )
  }

  if (!result) {
    return <div className="font-medium">{name}</div>
  }

  return (
    <div className="space-y-0.5">
      <div className="font-medium">{name}</div>
      <div className="text-xs text-muted-foreground">
        {result.totalRings} R · {result.teiler.toFixed(1)} T · RT {result.ringteiler.toFixed(1)}
      </div>
    </div>
  )
}

function LegTable({
  title,
  matchups,
  deadline,
  isAdmin,
}: {
  title: string
  matchups: MatchupListItem[]
  deadline: Date | null
  isAdmin: boolean
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

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Schütze 1</th>
              <th className="px-4 py-2 text-left font-medium text-muted-foreground">Schütze 2</th>
              <th className="w-24 px-4 py-2 text-center font-medium text-muted-foreground">
                Status
              </th>
              {isAdmin && <th className="w-[110px] px-4 py-2" />}
            </tr>
          </thead>
          <tbody className="divide-y">
            {matchups.map((m) => {
              const isVoid = m.homeParticipant.withdrawn || m.awayParticipant?.withdrawn === true
              const isBye = m.status === "BYE"
              const isCompleted = m.status === "COMPLETED"

              let homeOutcome: "WIN" | "LOSS" | "DRAW" | null = null
              let awayOutcome: "WIN" | "LOSS" | "DRAW" | null = null
              let homeResult: MatchResultSummary | undefined
              let awayResult: MatchResultSummary | undefined

              if (isCompleted && m.awayParticipant) {
                homeResult = m.results.find((r) => r.participantId === m.homeParticipant.id)
                awayResult = m.results.find((r) => r.participantId === m.awayParticipant!.id)

                if (homeResult && awayResult) {
                  const raw = determineOutcome(homeResult, awayResult)
                  if (raw === "HOME_WIN") {
                    homeOutcome = "WIN"
                    awayOutcome = "LOSS"
                  } else if (raw === "AWAY_WIN") {
                    homeOutcome = "LOSS"
                    awayOutcome = "WIN"
                  } else {
                    homeOutcome = "DRAW"
                    awayOutcome = "DRAW"
                  }
                }
              }

              return (
                <tr
                  key={m.id}
                  className={`transition-colors ${isVoid ? "opacity-50" : "hover:bg-muted/20"}`}
                >
                  <td className={`px-4 py-3 ${homeOutcome === "WIN" ? "bg-emerald-500/10" : ""}`}>
                    <ParticipantResult participant={m.homeParticipant} result={homeResult} />
                  </td>
                  <td className={`px-4 py-3 ${awayOutcome === "WIN" ? "bg-emerald-500/10" : ""}`}>
                    {m.awayParticipant ? (
                      <ParticipantResult participant={m.awayParticipant} result={awayResult} />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={m.status} />
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-right">
                      {!isBye && m.awayParticipant && !isVoid && (
                        <ResultEntryDialog
                          matchupId={m.id}
                          homeName={participantName(m.homeParticipant)}
                          awayName={participantName(m.awayParticipant)}
                          homeParticipantId={m.homeParticipant.id}
                          awayParticipantId={m.awayParticipant.id}
                          existingResults={m.results}
                          isCorrection={isCompleted}
                        />
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === "COMPLETED") {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
        {STATUS_LABEL[status]}
      </span>
    )
  }
  if (status === "BYE" || status === "WALKOVER") {
    return (
      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        {STATUS_LABEL[status]}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium text-muted-foreground">
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

export function ScheduleView({ matchups, firstLegDeadline, secondLegDeadline, isAdmin }: Props) {
  if (matchups.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Noch kein Spielplan generiert.
      </p>
    )
  }

  const firstLeg = matchups
    .filter((m) => m.round === "FIRST_LEG" && m.status !== "BYE")
    .sort((a, b) => a.roundIndex - b.roundIndex)

  const secondLeg = matchups
    .filter((m) => m.round === "SECOND_LEG" && m.status !== "BYE")
    .sort((a, b) => a.roundIndex - b.roundIndex)

  return (
    <div className="space-y-8">
      {firstLeg.length > 0 && (
        <LegTable
          title="Hinrunde"
          matchups={firstLeg}
          deadline={firstLegDeadline}
          isAdmin={isAdmin}
        />
      )}
      {secondLeg.length > 0 && (
        <LegTable
          title="Rückrunde"
          matchups={secondLeg}
          deadline={secondLegDeadline}
          isAdmin={isAdmin}
        />
      )}
    </div>
  )
}

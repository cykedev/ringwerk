import { Clock } from "lucide-react"
import { formatDateOnly, getDisplayTimeZone } from "@/lib/dateTime"
import { determineOutcome } from "@/lib/results/calculateResult"
import type { ScoringMode } from "@/generated/prisma/client"
import type { MatchupListItem, MatchupParticipant, MatchResultSummary } from "@/lib/matchups/types"
import { ResultEntryDialog } from "@/components/app/results/ResultEntryDialog"

interface Props {
  matchups: MatchupListItem[]
  hinrundeDeadline: Date | null
  rueckrundeDeadline: Date | null
  competitionId: string
  /** Nur ADMIN darf Ergebnisse eintragen */
  canManage: boolean
  /** Keine Erfassung/Korrektur mehr möglich wenn Playoffs laufen */
  playoffsStarted?: boolean
  scoringMode?: ScoringMode
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
  isVoid = false,
}: {
  participant: MatchupParticipant
  result: MatchResultSummary | undefined
  isVoid?: boolean
}) {
  const name = participantName(participant)

  if (isVoid || participant.withdrawn) {
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
        {result.rings} R · {result.teiler.toFixed(1)} T · RT {result.ringteiler.toFixed(1)}
      </div>
    </div>
  )
}

function LegTable({
  title,
  matchups,
  deadline,
  canManage,
  scoringMode,
}: {
  title: string
  matchups: MatchupListItem[]
  deadline: Date | null
  canManage: boolean
  scoringMode: ScoringMode
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

      <div className="overflow-hidden rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="px-2 py-2 text-left font-medium text-muted-foreground sm:px-4">
                Schütze 1
              </th>
              <th className="px-2 py-2 text-left font-medium text-muted-foreground sm:px-4">
                Schütze 2
              </th>
              <th className="w-10 px-2 py-2 text-center font-medium text-muted-foreground sm:w-24 sm:px-4">
                Status
              </th>
              {canManage && <th className="w-[60px] px-2 py-2 sm:w-[110px] sm:px-4" />}
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
                  const raw = determineOutcome(homeResult, awayResult, scoringMode)
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
                  <td
                    className={`px-2 py-3 sm:px-4 ${homeOutcome === "WIN" && !isVoid ? "bg-emerald-500/10" : ""}`}
                  >
                    <ParticipantResult
                      participant={m.homeParticipant}
                      result={homeResult}
                      isVoid={isVoid}
                    />
                  </td>
                  <td
                    className={`px-2 py-3 sm:px-4 ${awayOutcome === "WIN" && !isVoid ? "bg-emerald-500/10" : ""}`}
                  >
                    {m.awayParticipant ? (
                      <ParticipantResult
                        participant={m.awayParticipant}
                        result={awayResult}
                        isVoid={isVoid}
                      />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-2 py-3 text-center sm:px-4">
                    <StatusBadge status={m.status} />
                  </td>
                  {canManage && (
                    <td className="px-2 py-3 text-right sm:px-4">
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
        ✓
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
  if (status === "PENDING") {
    return (
      <span className="inline-flex items-center justify-center">
        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium text-muted-foreground">
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

export function ScheduleView({
  matchups,
  hinrundeDeadline,
  rueckrundeDeadline,
  canManage,
  playoffsStarted = false,
  scoringMode = "RINGTEILER",
}: Props) {
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
          deadline={hinrundeDeadline}
          canManage={canManage && !playoffsStarted}
          scoringMode={scoringMode}
        />
      )}
      {secondLeg.length > 0 && (
        <LegTable
          title="Rückrunde"
          matchups={secondLeg}
          deadline={rueckrundeDeadline}
          canManage={canManage && !playoffsStarted}
          scoringMode={scoringMode}
        />
      )}
    </div>
  )
}

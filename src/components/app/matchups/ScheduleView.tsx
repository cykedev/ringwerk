import { Clock } from "lucide-react"
import { formatDateOnly, getDisplayTimeZone } from "@/lib/dateTime"
import { determineOutcome } from "@/lib/results/calculateResult"
import type { LeagueFormat, ScoringMode, ScoringType } from "@/generated/prisma/client"
import type { MatchupListItem, MatchupParticipant, MatchResultSummary } from "@/lib/matchups/types"
import { ResultEntryDialog } from "@/components/app/results/ResultEntryDialog"
import { BestOfEntryDialog } from "@/components/app/matchups/BestOfEntryDialog"
import { formatDecimal1, formatRings, getEffectiveScoringType } from "@/lib/series/scoring-format"
import {
  bestOfDuelTally,
  duelOutcome,
  resolveBestOf,
  stechschussOutcome,
} from "@/lib/scoring/bestOf"
import { effectiveTeilerFaktor } from "@/lib/scoring/calculateScore"
import type { DuelSeries } from "@/lib/scoring/bestOf"

// ─── Shared best-of config for BEST_OF_SINGLE layout ──────────────────────────

interface BestOfConfig {
  disciplineId: string | null
  groupBestOf: number
  groupPlayAllDuels: boolean
  groupTiebreaker1: ScoringMode | null
  groupTiebreaker2: ScoringMode | null
  /** Effective teilerFaktor for live corrected-teiler hint. */
  competitionTeilerFaktor: number
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  matchups: MatchupListItem[]
  hinrundeDeadline: Date | null
  rueckrundeDeadline: Date | null
  competitionId: string
  /** Nur ADMIN/MANAGER darf Ergebnisse eintragen */
  canManage: boolean
  /** Keine Erfassung/Korrektur mehr möglich wenn Playoffs laufen */
  playoffsStarted?: boolean
  scoringMode?: ScoringMode
  /** @deprecated Per-Teilnehmer-Typen werden aus MatchupParticipant.scoringType berechnet */
  scoringType?: ScoringType
  shotsPerSeries: number
  competitionTeilerFaktor?: number
  /** DOUBLE_ROUND_ROBIN (default) or BEST_OF_SINGLE — controls which entry UI is rendered. */
  leagueFormat?: LeagueFormat
  /** Required when leagueFormat is BEST_OF_SINGLE. */
  bestOfConfig?: BestOfConfig
}

// ─── Classic table layout (DOUBLE_ROUND_ROBIN) ────────────────────────────────

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
  scoringType,
  isVoid = false,
}: {
  participant: MatchupParticipant
  result: MatchResultSummary | undefined
  scoringType: ScoringType
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
        {formatRings(result.rings, scoringType)} R · {formatDecimal1(result.teiler)} T · RT{" "}
        {formatDecimal1(result.ringteiler)}
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

function ClassicLegTable({
  title,
  matchups,
  deadline,
  canManage,
  scoringMode,
  shotsPerSeries,
  competitionTeilerFaktor = 1,
}: {
  title: string
  matchups: MatchupListItem[]
  deadline: Date | null
  canManage: boolean
  scoringMode: ScoringMode
  shotsPerSeries: number
  competitionTeilerFaktor?: number
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

              const homeScoringType = getEffectiveScoringType(
                scoringMode,
                m.homeParticipant.scoringType
                  ? { scoringType: m.homeParticipant.scoringType }
                  : null
              )
              const awayScoringType = m.awayParticipant
                ? getEffectiveScoringType(
                    scoringMode,
                    m.awayParticipant.scoringType
                      ? { scoringType: m.awayParticipant.scoringType }
                      : null
                  )
                : "WHOLE"

              const homeTeilerFaktor = m.homeParticipant.teilerFaktor ?? competitionTeilerFaktor
              const awayTeilerFaktor = m.awayParticipant?.teilerFaktor ?? competitionTeilerFaktor

              if (isCompleted && m.awayParticipant) {
                // For classic matchups: aggregate by summing all regular (non-tiebreak) series
                // per participant — there is only one per side in DOUBLE_ROUND_ROBIN.
                homeResult = m.results.find(
                  (r) => r.participantId === m.homeParticipant.id && !r.isTiebreak
                )
                awayResult = m.results.find(
                  (r) => r.participantId === m.awayParticipant!.id && !r.isTiebreak
                )

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
                      scoringType={homeScoringType}
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
                        scoringType={awayScoringType}
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
                          homeScoringType={homeScoringType}
                          awayScoringType={awayScoringType}
                          shotsPerSeries={shotsPerSeries}
                          homeTeilerFaktor={homeTeilerFaktor}
                          awayTeilerFaktor={awayTeilerFaktor}
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

// ─── Best-of compact table layout (BEST_OF_SINGLE) ───────────────────────────

/**
 * Derives the compact display label for a best-of matchup's current state.
 *
 * - complete + decided by Stechschuss → "1:1 n. St."
 * - complete → "2:1" (Satz-Ergebnis)
 * - in_progress with some duels → "1:0 (2 offen)"
 * - not started → "offen"
 * - needs_tiebreak → "Stechschuss"
 */
function deriveBestOfLabel(
  homeId: string,
  awayId: string,
  series: MatchResultSummary[],
  disciplineId: string | null,
  scoringMode: ScoringMode,
  tiebreaker1: ScoringMode | null,
  tiebreaker2: ScoringMode | null,
  bestOf: number,
  playAll: boolean
): { label: string; isComplete: boolean; winner: "home" | "away" | null } {
  const regularByDuel = new Map<number, { home?: DuelSeries; away?: DuelSeries }>()
  const tiebreakByDuel = new Map<number, { homeRings?: number; awayRings?: number }>()

  for (const s of series) {
    if (s.duelNumber === null) continue
    if (s.isTiebreak) {
      const existing = tiebreakByDuel.get(s.duelNumber) ?? {}
      if (s.participantId === homeId) {
        tiebreakByDuel.set(s.duelNumber, { ...existing, homeRings: s.rings })
      } else if (s.participantId === awayId) {
        tiebreakByDuel.set(s.duelNumber, { ...existing, awayRings: s.rings })
      }
    } else {
      const factor = effectiveTeilerFaktor(disciplineId, 1)
      const entry: DuelSeries = {
        rings: s.rings,
        correctedTeiler: s.teiler * factor,
        ringteiler: s.ringteiler,
      }
      const existing = regularByDuel.get(s.duelNumber) ?? {}
      if (s.participantId === homeId) {
        regularByDuel.set(s.duelNumber, { ...existing, home: entry })
      } else if (s.participantId === awayId) {
        regularByDuel.set(s.duelNumber, { ...existing, away: entry })
      }
    }
  }

  const completePairs = Array.from(regularByDuel.entries())
    .filter(([, pair]) => pair.home && pair.away)
    .sort(([a], [b]) => a - b)

  const regularOutcomes = completePairs.map(([, pair]) =>
    duelOutcome(pair.home!, pair.away!, scoringMode, tiebreaker1, tiebreaker2)
  )

  const tiebreakOutcomes = Array.from(tiebreakByDuel.entries())
    .filter(([, pair]) => pair.homeRings !== undefined && pair.awayRings !== undefined)
    .sort(([a], [b]) => a - b)
    .map(([, pair]) => stechschussOutcome(pair.homeRings!, pair.awayRings!))

  const status = resolveBestOf(regularOutcomes, tiebreakOutcomes, { bestOf, playAll })

  const { homeWins, awayWins, decidedByStechschuss } = bestOfDuelTally(regularOutcomes, status)

  if (status.kind === "complete") {
    const scoreLabel = `${homeWins}:${awayWins}`
    return {
      label: decidedByStechschuss ? `${scoreLabel} n. St.` : scoreLabel,
      isComplete: true,
      winner: status.winner === "A" ? "home" : "away",
    }
  }

  if (status.kind === "needs_tiebreak") {
    return { label: "Stechschuss", isComplete: false, winner: null }
  }

  // in_progress
  const completedCount = completePairs.length
  const remaining = bestOf - completedCount
  if (completedCount === 0) {
    return { label: "offen", isComplete: false, winner: null }
  }
  return {
    label: `${homeWins}:${awayWins} (${remaining} ${remaining === 1 ? "Duell" : "Duelle"} offen)`,
    isComplete: false,
    winner: null,
  }
}

function BestOfMatchupTable({
  matchups,
  canManage,
  scoringMode,
  shotsPerSeries,
  bestOfConfig,
}: {
  matchups: MatchupListItem[]
  canManage: boolean
  scoringMode: ScoringMode
  shotsPerSeries: number
  bestOfConfig: BestOfConfig
}) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="px-2 py-2 text-left font-medium text-muted-foreground sm:px-4">
              Teilnehmer A
            </th>
            <th className="px-2 py-2 text-left font-medium text-muted-foreground sm:px-4">
              Teilnehmer B
            </th>
            <th className="w-28 px-2 py-2 text-center font-medium text-muted-foreground sm:px-4">
              Stand
            </th>
            {canManage && <th className="w-[50px] px-2 py-2 sm:w-[60px] sm:px-4" />}
          </tr>
        </thead>
        <tbody className="divide-y">
          {matchups.map((m) => {
            const isBye = m.status === "BYE" || !m.awayParticipant
            const isVoid = m.homeParticipant.withdrawn || m.awayParticipant?.withdrawn === true

            if (isBye) {
              return (
                <tr key={m.id} className="opacity-60">
                  <td className="px-2 py-3 sm:px-4">
                    <span className="font-medium">{participantName(m.homeParticipant)}</span>
                  </td>
                  <td className="px-2 py-3 text-muted-foreground sm:px-4">—</td>
                  <td className="px-2 py-3 text-center sm:px-4">
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      Freilos
                    </span>
                  </td>
                  {canManage && <td className="px-2 py-3 sm:px-4" />}
                </tr>
              )
            }

            if (isVoid) {
              return (
                <tr key={m.id} className="opacity-50">
                  <td className="px-2 py-3 sm:px-4">
                    <span className="line-through text-muted-foreground">
                      {participantName(m.homeParticipant)}
                    </span>
                  </td>
                  <td className="px-2 py-3 sm:px-4">
                    <span className="line-through text-muted-foreground">
                      {participantName(m.awayParticipant!)}
                    </span>
                  </td>
                  <td className="px-2 py-3 text-center text-muted-foreground sm:px-4">—</td>
                  {canManage && <td className="px-2 py-3 sm:px-4" />}
                </tr>
              )
            }

            const scoringType = getEffectiveScoringType(
              scoringMode,
              m.homeParticipant.scoringType ? { scoringType: m.homeParticipant.scoringType } : null
            )

            const { label, isComplete, winner } = deriveBestOfLabel(
              m.homeParticipant.id,
              m.awayParticipant!.id,
              m.results,
              bestOfConfig.disciplineId,
              scoringMode,
              bestOfConfig.groupTiebreaker1,
              bestOfConfig.groupTiebreaker2,
              bestOfConfig.groupBestOf,
              bestOfConfig.groupPlayAllDuels
            )

            const hasResults = m.results.length > 0

            return (
              <tr key={m.id} className="transition-colors hover:bg-muted/20">
                <td className={`px-2 py-3 sm:px-4 ${winner === "home" ? "bg-emerald-500/10" : ""}`}>
                  <span className="font-medium">{participantName(m.homeParticipant)}</span>
                </td>
                <td className={`px-2 py-3 sm:px-4 ${winner === "away" ? "bg-emerald-500/10" : ""}`}>
                  <span className="font-medium">{participantName(m.awayParticipant!)}</span>
                </td>
                <td className="px-2 py-3 text-center sm:px-4">
                  {isComplete ? (
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      {label}
                    </span>
                  ) : hasResults ? (
                    <span className="text-xs text-muted-foreground">{label}</span>
                  ) : (
                    <span className="inline-flex items-center justify-center">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    </span>
                  )}
                </td>
                {canManage && (
                  <td className="px-2 py-3 text-right sm:px-4">
                    <BestOfEntryDialog
                      matchupId={m.id}
                      homeParticipant={m.homeParticipant}
                      awayParticipant={m.awayParticipant!}
                      series={m.results}
                      canManage={canManage}
                      hasResults={hasResults}
                      scoringMode={scoringMode}
                      disciplineId={bestOfConfig.disciplineId}
                      groupBestOf={bestOfConfig.groupBestOf}
                      groupPlayAllDuels={bestOfConfig.groupPlayAllDuels}
                      groupTiebreaker1={bestOfConfig.groupTiebreaker1}
                      groupTiebreaker2={bestOfConfig.groupTiebreaker2}
                      shotsPerSeries={shotsPerSeries}
                      scoringType={scoringType}
                      teilerFaktor={bestOfConfig.competitionTeilerFaktor}
                    />
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── ScheduleView ─────────────────────────────────────────────────────────────

export function ScheduleView({
  matchups,
  hinrundeDeadline,
  rueckrundeDeadline,
  canManage,
  playoffsStarted = false,
  scoringMode = "RINGTEILER",
  shotsPerSeries,
  competitionTeilerFaktor = 1,
  leagueFormat = "DOUBLE_ROUND_ROBIN",
  bestOfConfig,
}: Props) {
  if (matchups.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Noch kein Spielplan generiert.
      </p>
    )
  }

  const firstLeg = matchups
    .filter((m) => m.round === "FIRST_LEG")
    .sort((a, b) => a.roundIndex - b.roundIndex)

  const secondLeg = matchups
    .filter((m) => m.round === "SECOND_LEG")
    .sort((a, b) => a.roundIndex - b.roundIndex)

  // BEST_OF_SINGLE: one flat list of all encounters — no Spieltag grouping, no Hin-/Rückrunde.
  // Dates are agreed individually, so there are no fixed match days to group by.
  if (leagueFormat === "BEST_OF_SINGLE" && bestOfConfig) {
    // Byes ("Freilos") carry no information for the reader — omit them entirely.
    const allSorted = [...matchups]
      .filter((m) => m.awayParticipant !== null && m.status !== "BYE")
      .sort((a, b) => a.roundIndex - b.roundIndex)

    return (
      <BestOfMatchupTable
        matchups={allSorted}
        canManage={canManage && !playoffsStarted}
        scoringMode={scoringMode}
        shotsPerSeries={shotsPerSeries}
        bestOfConfig={bestOfConfig}
      />
    )
  }

  return (
    <div className="space-y-8">
      {firstLeg.length > 0 && (
        <ClassicLegTable
          title="Hinrunde"
          matchups={firstLeg}
          deadline={hinrundeDeadline}
          canManage={canManage && !playoffsStarted}
          scoringMode={scoringMode}
          shotsPerSeries={shotsPerSeries}
          competitionTeilerFaktor={competitionTeilerFaktor}
        />
      )}
      {secondLeg.length > 0 && (
        <ClassicLegTable
          title="Rückrunde"
          matchups={secondLeg}
          deadline={rueckrundeDeadline}
          canManage={canManage && !playoffsStarted}
          scoringMode={scoringMode}
          shotsPerSeries={shotsPerSeries}
          competitionTeilerFaktor={competitionTeilerFaktor}
        />
      )}
    </div>
  )
}

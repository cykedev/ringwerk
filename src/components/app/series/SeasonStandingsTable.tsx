"use client"

import { useState } from "react"
import { ChevronUp } from "lucide-react"
import type { SeasonStandingsEntry } from "@/lib/scoring/calculateSeasonStandings"

function RankBadge({ rank }: { rank: number }) {
  const base =
    "inline-flex w-[1.25rem] items-center justify-center rounded px-1 py-0.5 text-xs tabular-nums shrink-0"
  if (rank === 1)
    return (
      <span className={`${base} bg-amber-500/20 text-amber-700 dark:text-amber-400`}>{rank}</span>
    )
  if (rank === 2)
    return <span className={`${base} bg-gray-400/15 text-gray-500 dark:text-gray-400`}>{rank}</span>
  if (rank === 3)
    return (
      <span className={`${base} bg-orange-500/15 text-orange-700 dark:text-orange-400`}>
        {rank}
      </span>
    )
  return <span className={`${base} bg-muted text-muted-foreground`}>{rank}</span>
}

type SortCol = "rings" | "teiler" | "ringteiler"

function SortHeader({
  col,
  label,
  className,
  sortCol,
  setSortCol,
}: {
  col: SortCol
  label: string
  className?: string
  sortCol: SortCol
  setSortCol: (col: SortCol) => void
}) {
  const active = sortCol === col
  return (
    <th
      className={`px-3 py-2 text-right font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors${active ? " text-foreground" : ""}${className ? ` ${className}` : ""}`}
      onClick={() => setSortCol(col)}
    >
      <span className="inline-flex items-center justify-end gap-1">
        {label}
        {active && <ChevronUp className="h-3 w-3" />}
      </span>
    </th>
  )
}

function defaultSortCol(scoringMode: string): SortCol {
  if (scoringMode === "RINGS" || scoringMode === "RINGS_DECIMAL") return "rings"
  if (scoringMode === "TEILER") return "teiler"
  return "ringteiler"
}

function sortEntries(entries: SeasonStandingsEntry[], col: SortCol): SeasonStandingsEntry[] {
  return [...entries].sort((a, b) => {
    // Qualifizierte zuerst
    if (a.meetsMinSeries !== b.meetsMinSeries) return a.meetsMinSeries ? -1 : 1

    // Nach Wert sortieren (nicht nach Rang, damit auch Nicht-Qualifizierte sortiert werden)
    if (col === "rings") {
      if (a.bestRings !== null && b.bestRings !== null) return b.bestRings - a.bestRings
      if (a.bestRings !== null) return -1
      if (b.bestRings !== null) return 1
    } else if (col === "teiler") {
      if (a.bestCorrectedTeiler !== null && b.bestCorrectedTeiler !== null)
        return a.bestCorrectedTeiler - b.bestCorrectedTeiler
      if (a.bestCorrectedTeiler !== null) return -1
      if (b.bestCorrectedTeiler !== null) return 1
    } else {
      if (a.bestRingteiler !== null && b.bestRingteiler !== null)
        return a.bestRingteiler - b.bestRingteiler
      if (a.bestRingteiler !== null) return -1
      if (b.bestRingteiler !== null) return 1
    }
    return a.participantName.localeCompare(b.participantName)
  })
}

interface Props {
  entries: SeasonStandingsEntry[]
  minSeries: number | null
  scoringMode?: string
  isMixed?: boolean
}

export function SeasonStandingsTable({
  entries,
  minSeries,
  scoringMode = "RINGTEILER",
  isMixed = false,
}: Props) {
  const [sortCol, setSortCol] = useState<SortCol>(defaultSortCol(scoringMode))

  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">Noch keine Serien erfasst.</p>
  }

  const sorted = sortEntries(entries, sortCol)

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Name</th>
            {minSeries !== null && (
              <th className="px-3 py-2 text-right font-medium text-muted-foreground hidden sm:table-cell">
                Serien
              </th>
            )}
            <SortHeader col="rings" label="Beste Ringe" sortCol={sortCol} setSortCol={setSortCol} />
            <SortHeader
              col="teiler"
              label={isMixed ? "Best. Teiler korr." : "Best. Teiler"}
              className="hidden sm:table-cell"
              sortCol={sortCol}
              setSortCol={setSortCol}
            />
            <SortHeader
              col="ringteiler"
              label="Best. Ringteiler"
              sortCol={sortCol}
              setSortCol={setSortCol}
            />
          </tr>
        </thead>
        <tbody className="divide-y">
          {sorted.map((entry, idx) => {
            const qualified = entry.meetsMinSeries
            return (
              <tr key={entry.participantId} className="hover:bg-muted/30 transition-colors">
                <td className="px-3 py-2 font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    <RankBadge rank={idx + 1} />
                    <span className={qualified ? "" : "text-muted-foreground"}>
                      {entry.participantName}
                      {!qualified && minSeries !== null && (
                        <span className="ml-1.5 text-xs sm:hidden">
                          ({entry.seriesCount}/{minSeries})
                        </span>
                      )}
                    </span>
                  </span>
                </td>
                {minSeries !== null && (
                  <td className="px-3 py-2 text-right tabular-nums hidden sm:table-cell">
                    <span
                      className={
                        qualified
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-500 dark:text-rose-400"
                      }
                    >
                      {entry.seriesCount}/{minSeries}
                    </span>
                  </td>
                )}
                <td className="px-3 py-2 tabular-nums">
                  <div className="flex items-center justify-end gap-1.5">
                    {entry.bestRings !== null ? (
                      <>
                        <span>{entry.bestRings}</span>
                        <RankBadge rank={entry.bestRings_rank ?? idx + 1} />
                      </>
                    ) : (
                      <span className="text-muted-foreground">–</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 tabular-nums hidden sm:table-cell">
                  <div className="flex items-center justify-end gap-1.5">
                    {entry.bestCorrectedTeiler !== null ? (
                      <>
                        <span>{entry.bestCorrectedTeiler.toFixed(1)}</span>
                        <RankBadge rank={entry.bestTeiler_rank ?? idx + 1} />
                      </>
                    ) : (
                      <span className="text-muted-foreground">–</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 tabular-nums font-medium">
                  <div className="flex items-center justify-end gap-1.5">
                    {entry.bestRingteiler !== null ? (
                      <>
                        <span>{entry.bestRingteiler.toFixed(1)}</span>
                        <RankBadge rank={entry.bestRingteiler_rank ?? idx + 1} />
                      </>
                    ) : (
                      <span className="text-muted-foreground">–</span>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

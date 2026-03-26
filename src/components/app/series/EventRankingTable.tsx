import type { EventRankedEntry } from "@/lib/scoring/rankEventParticipants"
import { Badge } from "@/components/ui/badge"
import { RankBadge } from "@/components/ui/rank-badge"

interface Props {
  entries: EventRankedEntry[]
  scoringMode: string
  isMixed?: boolean
}

const SCORE_LABEL: Record<string, string> = {
  RINGTEILER: "Ringteiler",
  RINGS: "Ringe",
  RINGS_DECIMAL: "Ringe",
  TEILER: "Teiler",
  DECIMAL_REST: "Dezimalrest",
  TARGET_ABSOLUTE: "Abweichung",
  TARGET_UNDER: "Abweichung",
}

export function EventRankingTable({ entries, scoringMode, isMixed = false }: Props) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">Noch keine Ergebnisse erfasst.</p>
  }

  const scoreLabel = SCORE_LABEL[scoringMode] ?? "Score"

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-3 py-2 text-left font-medium text-muted-foreground w-10">Pl.</th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Name</th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground hidden sm:table-cell">
              Disziplin
            </th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">Ringe</th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground hidden sm:table-cell">
              {isMixed ? "Teiler korr." : "Teiler"}
            </th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">{scoreLabel}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {entries.map((entry) => (
            <tr key={entry.seriesId} className="hover:bg-muted/30 transition-colors">
              <td className="px-3 py-2">
                <RankBadge rank={entry.rank} />
              </td>
              <td className="px-3 py-2 font-medium">
                <span className="flex items-center gap-1.5 flex-wrap">
                  {entry.participantName}
                  {entry.isGuest && (
                    <Badge variant="outline" className="text-xs">
                      Gast
                    </Badge>
                  )}
                </span>
              </td>
              <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">
                {entry.disciplineName}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{entry.rings}</td>
              <td className="px-3 py-2 text-right tabular-nums text-muted-foreground hidden sm:table-cell">
                {isMixed ? entry.correctedTeiler.toFixed(1) : entry.teiler.toFixed(1)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums font-medium">
                {formatScore(entry.score, scoringMode)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function formatScore(score: number, mode: string): string {
  if (mode === "TARGET_UNDER" && score >= 1e9) {
    return `+${(score - 1e9).toFixed(1)}`
  }
  if (mode === "RINGS" || mode === "DECIMAL_REST") {
    return score.toFixed(0)
  }
  return score.toFixed(1)
}

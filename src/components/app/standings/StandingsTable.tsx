import type { StandingRow } from "@/lib/standings/queries"

interface Props {
  rows: StandingRow[]
}

const RANK_RING: Record<number, string> = {
  1: "ring-2 ring-yellow-400 text-yellow-400 bg-yellow-400/15",
  2: "ring-2 ring-slate-400 text-slate-400 bg-slate-400/15",
  3: "ring-2 ring-orange-500 text-orange-500 bg-orange-500/15",
}

const ROW_HIGHLIGHT: Record<number, string> = {
  1: "bg-yellow-400/5",
  2: "bg-slate-400/5",
  3: "bg-orange-500/5",
}

function RankBadge({ rank }: { rank: number }) {
  const ringStyle = RANK_RING[rank]

  return (
    <span
      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
        ringStyle ?? "text-muted-foreground"
      }`}
    >
      {rank}
    </span>
  )
}

export function StandingsTable({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Keine Teilnehmer eingeschrieben.
      </p>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="w-10 px-4 py-2.5 text-center font-medium text-muted-foreground">Pl.</th>
            <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Name</th>
            <th className="px-4 py-2.5 text-center font-medium text-muted-foreground">Sp.</th>
            <th className="px-4 py-2.5 text-center font-medium text-muted-foreground">S</th>
            <th className="px-4 py-2.5 text-center font-medium text-muted-foreground">U</th>
            <th className="px-4 py-2.5 text-center font-medium text-muted-foreground">N</th>
            <th className="px-4 py-2.5 text-center font-semibold">Pkt.</th>
            <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Best. RT</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => {
            const rowHighlight = row.withdrawn ? "" : (ROW_HIGHLIGHT[row.rank ?? 0] ?? "")
            return (
              <tr
                key={row.participantId}
                className={`transition-colors ${
                  row.withdrawn ? "opacity-50" : `hover:bg-muted/20 ${rowHighlight}`
                }`}
              >
                <td className="px-4 py-3 text-center">
                  {row.withdrawn || row.rank === null ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <RankBadge rank={row.rank} />
                  )}
                </td>
                <td className="px-4 py-3 font-medium">
                  {row.withdrawn ? (
                    <span className="line-through text-muted-foreground">
                      {row.lastName}, {row.firstName}
                      <span className="ml-2 text-xs not-italic no-underline">(Zurückgezogen)</span>
                    </span>
                  ) : (
                    <>
                      {row.lastName}, {row.firstName}
                    </>
                  )}
                </td>
                <td className="px-4 py-3 text-center text-muted-foreground">{row.played}</td>
                <td className="px-4 py-3 text-center">
                  {row.wins > 0 ? (
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">
                      {row.wins}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">{row.wins}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  {row.draws > 0 ? (
                    <span className="font-medium text-amber-600 dark:text-amber-400">
                      {row.draws}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">{row.draws}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  {row.losses > 0 ? (
                    <span className="text-muted-foreground">{row.losses}</span>
                  ) : (
                    <span className="text-muted-foreground">{row.losses}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {row.points}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-muted-foreground">
                  {row.bestRingteiler !== null ? row.bestRingteiler.toFixed(1) : "—"}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

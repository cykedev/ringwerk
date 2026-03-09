import type { PlayoffBracketData, PlayoffMatchItem } from "@/lib/playoffs/types"
import { cn } from "@/lib/utils"
import { PlayoffMatchCard } from "./PlayoffMatchCard"

const SLOT_H = 80 // px – Kartenhöhe
const SLOT_W = 176 // px – w-44
const CONN_W = 28 // px – SVG-Connector-Breite
const PAIR_GAP = 32 // px – Abstand zwischen den Paarungen

// Gold / Silber / Bronze je nach Runde
const WINNER_STYLE: Record<string, { row: string; text: string; badge: string }> = {
  FINAL: {
    row: "bg-yellow-400/5",
    text: "text-yellow-600 dark:text-yellow-400",
    badge: "bg-yellow-400/15 text-yellow-600 ring-1 ring-yellow-400 dark:text-yellow-400",
  },
  SEMI_FINAL: {
    row: "bg-slate-400/5",
    text: "text-slate-500 dark:text-slate-300",
    badge: "bg-slate-400/15 text-slate-500 ring-1 ring-slate-400 dark:text-slate-300",
  },
  QUARTER_FINAL: {
    row: "bg-orange-500/5",
    text: "text-orange-600 dark:text-orange-400",
    badge: "bg-orange-500/15 text-orange-600 ring-1 ring-orange-500 dark:text-orange-400",
  },
}

// ─── BracketSlot ─────────────────────────────────────────────────────────────

function BracketSlot({ match }: { match?: PlayoffMatchItem }) {
  if (!match) {
    return (
      <div
        style={{ height: SLOT_H, width: SLOT_W }}
        className="flex items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground/50"
      >
        Ausstehend
      </div>
    )
  }

  const nameA = `${match.participantA.firstName} ${match.participantA.lastName}`
  const nameB = `${match.participantB.firstName} ${match.participantB.lastName}`
  const winnerId =
    match.winsA > match.winsB
      ? match.participantA.id
      : match.winsB > match.winsA
        ? match.participantB.id
        : null

  return (
    <div
      style={{ height: SLOT_H, width: SLOT_W }}
      className={cn(
        "overflow-hidden rounded-lg border bg-card shadow-sm",
        match.status === "COMPLETED" && "border-muted"
      )}
    >
      <div className="flex h-full flex-col divide-y divide-border">
        {(
          [
            { name: nameA, wins: match.winsA, id: match.participantA.id },
            { name: nameB, wins: match.winsB, id: match.participantB.id },
          ] as const
        ).map(({ name, wins, id }) => {
          const isWinner = winnerId === id
          const style = WINNER_STYLE[match.round]
          return (
            <div
              key={id}
              className={cn(
                "flex flex-1 items-center justify-between gap-1 px-2.5",
                isWinner && style?.row
              )}
            >
              <span
                className={cn(
                  "min-w-0 truncate text-xs font-medium",
                  isWinner ? style?.text : "text-muted-foreground"
                )}
              >
                {name}
              </span>
              <span
                className={cn(
                  "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums",
                  isWinner ? style?.badge : "text-muted-foreground"
                )}
              >
                {wins}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Connector ───────────────────────────────────────────────────────────────

interface ConnectorPair {
  in1: number // y-Mittelpunkt erster Eingang
  in2: number // y-Mittelpunkt zweiter Eingang
  out: number // y-Mittelpunkt Ausgang
}

function Connector({ height, pairs }: { height: number; pairs: ConnectorPair[] }) {
  const mid = CONN_W / 2
  return (
    <svg
      width={CONN_W}
      height={height}
      style={{ display: "block", flexShrink: 0 }}
      className="text-border"
    >
      {pairs.map(({ in1, in2, out }, i) => (
        <g key={i} stroke="currentColor" strokeWidth={1} fill="none">
          <line x1={0} y1={in1} x2={mid} y2={in1} />
          <line x1={0} y1={in2} x2={mid} y2={in2} />
          <line x1={mid} y1={in1} x2={mid} y2={in2} />
          <line x1={mid} y1={out} x2={CONN_W} y2={out} />
        </g>
      ))}
    </svg>
  )
}

// ─── RoundCol ─────────────────────────────────────────────────────────────────

function RoundCol({
  matches,
  tops,
  totalH,
}: {
  matches: (PlayoffMatchItem | undefined)[]
  tops: number[]
  totalH: number
}) {
  return (
    <div className="relative shrink-0" style={{ width: SLOT_W, height: totalH }}>
      {matches.map((match, i) => (
        <div
          key={match?.id ?? `placeholder-${i}`}
          className="absolute left-0"
          style={{ top: tops[i] }}
        >
          <BracketSlot match={match} />
        </div>
      ))}
    </div>
  )
}

// ─── RoundDetail ─────────────────────────────────────────────────────────────

function RoundDetail({
  title,
  matches,
  isAdmin,
}: {
  title: string
  matches: PlayoffMatchItem[]
  isAdmin: boolean
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground">{title}</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        {matches.map((m) => (
          <PlayoffMatchCard key={m.id} match={m} isAdmin={isAdmin} />
        ))}
      </div>
    </div>
  )
}

// ─── PlayoffBracket ──────────────────────────────────────────────────────────

interface Props {
  bracket: PlayoffBracketData
  isAdmin: boolean
  /** Nur visuelles Bracket, keine Detail-Karten */
  compact?: boolean
}

export function PlayoffBracket({ bracket, isAdmin, compact = false }: Props) {
  const { quarterFinals: qf, semiFinals: hf, final: fin } = bracket
  const isVF = qf.length > 0

  if (!isVF && hf.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Die Playoff-Paarungen werden nach dem Start angezeigt.
      </p>
    )
  }

  // ── Positionen berechnen ─────────────────────────────────────────────────
  //
  // PAIR_GAP trennt die Gruppen, die in dieselbe nächste Runde einfließen:
  //   HF-only:  HF1 | GAP | HF2  →  Finale (mittig zw. HF1 und HF2)
  //   VF:       (QF1+QF2) | GAP | (QF3+QF4)  →  HF1 + HF2  →  Finale
  //
  const totalH = isVF ? 4 * SLOT_H + PAIR_GAP : 2 * SLOT_H + PAIR_GAP

  // QF-Tops: erste Gruppe direkt oben, zweite Gruppe nach GAP
  const qfTops = [0, SLOT_H, 2 * SLOT_H + PAIR_GAP, 3 * SLOT_H + PAIR_GAP]

  // HF-Tops: zentriert zwischen ihren QF-Paaren (oder ganz oben bei HF-only)
  const hfTops = isVF ? [SLOT_H / 2, 2.5 * SLOT_H + PAIR_GAP] : [0, SLOT_H + PAIR_GAP]

  const finalTop = isVF ? 1.5 * SLOT_H + PAIR_GAP / 2 : SLOT_H / 2 + PAIR_GAP / 2

  // QF → HF Connector-Paare (nur bei VF)
  const qfHfPairs: ConnectorPair[] = [
    { in1: SLOT_H * 0.5, in2: SLOT_H * 1.5, out: SLOT_H },
    {
      in1: 2.5 * SLOT_H + PAIR_GAP,
      in2: 3.5 * SLOT_H + PAIR_GAP,
      out: 3 * SLOT_H + PAIR_GAP,
    },
  ]

  // HF → Finale Connector-Paare
  const hfFinalPairs: ConnectorPair[] = isVF
    ? [
        {
          in1: SLOT_H,
          in2: 3 * SLOT_H + PAIR_GAP,
          out: 2 * SLOT_H + PAIR_GAP / 2,
        },
      ]
    : [
        {
          in1: SLOT_H / 2,
          in2: 1.5 * SLOT_H + PAIR_GAP,
          out: SLOT_H + PAIR_GAP / 2, // finalTop(=SLOT_H/2+PAIR_GAP/2) + SLOT_H/2
        },
      ]

  const labelClass =
    "text-center text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"

  return (
    <div className="space-y-8">
      {/* ── Visuelles Bracket ──────────────────────────────────────────── */}
      <div className="overflow-x-auto">
        <div className="min-w-max">
          {/* Spaltenüberschriften */}
          <div className="mb-2 flex items-center">
            {isVF && (
              <>
                <div style={{ width: SLOT_W }} className={labelClass}>
                  Viertelfinale
                </div>
                <div style={{ width: CONN_W }} />
              </>
            )}
            <div style={{ width: SLOT_W }} className={labelClass}>
              Halbfinale
            </div>
            <div style={{ width: CONN_W }} />
            <div style={{ width: SLOT_W }} className={labelClass}>
              Finale
            </div>
          </div>

          {/* Bracket-Zeilen */}
          <div className="flex items-start">
            {isVF && (
              <>
                <RoundCol
                  matches={[qf.at(0), qf.at(1), qf.at(2), qf.at(3)]}
                  tops={qfTops}
                  totalH={totalH}
                />
                <Connector height={totalH} pairs={qfHfPairs} />
              </>
            )}
            <RoundCol matches={[hf.at(0), hf.at(1)]} tops={hfTops} totalH={totalH} />
            <Connector height={totalH} pairs={hfFinalPairs} />
            <RoundCol matches={[fin ?? undefined]} tops={[finalTop]} totalH={totalH} />
          </div>
        </div>
      </div>

      {/* ── Detailkarten ───────────────────────────────────────────────── */}
      {!compact && (
        <div className="space-y-6">
          {isVF && qf.length > 0 && (
            <RoundDetail title="Viertelfinale" matches={qf} isAdmin={isAdmin} />
          )}
          {hf.length > 0 && <RoundDetail title="Halbfinale" matches={hf} isAdmin={isAdmin} />}
          {fin && <RoundDetail title="Finale" matches={[fin]} isAdmin={isAdmin} />}
        </div>
      )}
    </div>
  )
}

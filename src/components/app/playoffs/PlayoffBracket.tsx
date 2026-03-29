import type { ScoringMode } from "@/generated/prisma/client"
import type { PlayoffBracketData, PlayoffMatchItem } from "@/lib/playoffs/types"
import { cn } from "@/lib/utils"
import { PlayoffMatchCard } from "./PlayoffMatchCard"

const SLOT_H = 80 // px – Kartenhöhe
const SLOT_W = 176 // px – w-44
const CONN_W = 28 // px – SVG-Connector-Breite
const INNER_GAP = 8 // px – Abstand zwischen den zwei Karten einer Paarung
const OUTER_GAP = 48 // px – Abstand zwischen den Paarungsgruppen

// Gold / Silber / Bronze / Blau je nach Runde
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
  EIGHTH_FINAL: {
    row: "bg-blue-500/5",
    text: "text-blue-600 dark:text-blue-400",
    badge: "bg-blue-500/15 text-blue-600 ring-1 ring-blue-500 dark:text-blue-400",
  },
}

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

/** Gibt den Siegernamen eines abgeschlossenen Matches zurück, sonst undefined. */
function getWinnerName(match: PlayoffMatchItem | undefined): string | undefined {
  if (!match || match.status !== "COMPLETED") return undefined
  if (match.winsA > match.winsB)
    return `${match.participantA.firstName} ${match.participantA.lastName}`
  if (match.winsB > match.winsA)
    return `${match.participantB.firstName} ${match.participantB.lastName}`
  return undefined
}

// ─── BracketSlot ─────────────────────────────────────────────────────────────

interface SlotPreview {
  nameA?: string
  nameB?: string
}

function BracketSlot({ match, preview }: { match?: PlayoffMatchItem; preview?: SlotPreview }) {
  if (!match) {
    const hasPreview = preview?.nameA || preview?.nameB
    return (
      <div
        style={{ height: SLOT_H, width: SLOT_W }}
        className={cn("rounded-lg border border-dashed", hasPreview && "bg-card/50")}
      >
        {hasPreview ? (
          <div className="flex h-full flex-col divide-y divide-border/50">
            {([preview.nameA, preview.nameB] as const).map((name, i) => (
              <div key={i} className="flex flex-1 items-center px-2.5">
                <span className="min-w-0 truncate text-xs text-muted-foreground/40 italic">
                  {name ?? "—"}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground/50">
            Ausstehend
          </div>
        )}
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
  previews,
}: {
  matches: (PlayoffMatchItem | undefined)[]
  tops: number[]
  totalH: number
  previews?: (SlotPreview | undefined)[]
}) {
  return (
    <div className="relative shrink-0" style={{ width: SLOT_W, height: totalH }}>
      {matches.map((match, i) => (
        <div
          key={match?.id ?? `placeholder-${i}`}
          className="absolute left-0"
          style={{ top: tops[i] }}
        >
          <BracketSlot match={match} preview={previews?.[i]} />
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
  shotsPerSeries,
  playoffBestOf,
  finalePrimary,
  finaleTiebreaker1,
  finaleTiebreaker2,
}: {
  title: string
  matches: PlayoffMatchItem[]
  isAdmin: boolean
  shotsPerSeries: number
  playoffBestOf: number | null
  finalePrimary: ScoringMode
  finaleTiebreaker1: ScoringMode | null
  finaleTiebreaker2: ScoringMode | null
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground">{title}</h3>
      <div
        className={cn(
          "grid gap-4",
          matches.length > 2 && "sm:grid-cols-2",
          matches.length === 1 && "max-w-xs mx-auto sm:max-w-sm"
        )}
      >
        {matches.map((m) => (
          <PlayoffMatchCard
            key={m.id}
            match={m}
            isAdmin={isAdmin}
            shotsPerSeries={shotsPerSeries}
            playoffBestOf={playoffBestOf}
            finalePrimary={finalePrimary}
            finaleTiebreaker1={finaleTiebreaker1}
            finaleTiebreaker2={finaleTiebreaker2}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Geometrie-Hilfsfunktion ──────────────────────────────────────────────────

/**
 * Berechnet die Y-Mittelpunkte eines Slots-Arrays.
 * tops[i] ist die obere Kante, Mittelpunkt = tops[i] + SLOT_H/2.
 */
function mids(tops: number[]): number[] {
  return tops.map((t) => t + SLOT_H / 2)
}

/**
 * Berechnet den zentrierten Top-Wert zwischen zwei Y-Mittelpunkten.
 * center = (mid1 + mid2) / 2 → top = center - SLOT_H/2
 */
function centeredTop(mid1: number, mid2: number): number {
  return (mid1 + mid2) / 2 - SLOT_H / 2
}

// ─── PlayoffBracket ──────────────────────────────────────────────────────────

interface Props {
  bracket: PlayoffBracketData
  isAdmin: boolean
  /** Nur visuelles Bracket, keine Detail-Karten */
  compact?: boolean
  shotsPerSeries?: number
  playoffBestOf?: number | null
  finalePrimary?: ScoringMode
  finaleTiebreaker1?: ScoringMode | null
  finaleTiebreaker2?: ScoringMode | null
}

export function PlayoffBracket({
  bracket,
  isAdmin,
  compact = false,
  shotsPerSeries = 10,
  playoffBestOf = null,
  finalePrimary = "RINGS",
  finaleTiebreaker1 = null,
  finaleTiebreaker2 = null,
}: Props) {
  const { eighthFinals: af, quarterFinals: qf, semiFinals: hf, final: fin } = bracket
  const isAF = af.length > 0
  const isVF = !isAF && qf.length > 0

  if (!isAF && !isVF && hf.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Die Playoff-Paarungen werden nach dem Start angezeigt.
      </p>
    )
  }

  // ── Positionen berechnen ─────────────────────────────────────────────────
  //
  // Für jede Struktur (AF / VF / HF-only) werden die Slot-Tops und
  // Connector-Pairs separat berechnet.
  //
  // AF-Layout (8 AF → 4 QF → 2 HF → 1 Final):
  //   AF[0,1] → QF[0]; AF[2,3] → QF[1] (beide → HF[0])
  //   AF[4,5] → QF[2]; AF[6,7] → QF[3] (beide → HF[1])
  //   HF[0]+HF[1] → Final
  //
  //   PAIR_GAP trennt die Paare innerhalb einer Gruppe (AF[0,1] / AF[2,3]).
  //   Ein weiterer PAIR_GAP trennt die beiden Gruppen voneinander.

  let totalH: number
  let afTops: number[]
  let qfTops: number[]
  let hfTops: number[]
  let finalTop: number
  let afQfPairs: ConnectorPair[]
  let qfHfPairs: ConnectorPair[]
  let hfFinalPairs: ConnectorPair[]

  const half = SLOT_H / 2

  if (isAF) {
    // 8 AF-Slots: je 2 Slots pro QF.
    // INNER_GAP trennt die zwei Karten innerhalb einer Paarung.
    // OUTER_GAP trennt die Paarungen voneinander.
    afTops = [
      0,
      SLOT_H + INNER_GAP,
      2 * SLOT_H + INNER_GAP + OUTER_GAP,
      3 * SLOT_H + 2 * INNER_GAP + OUTER_GAP,
      4 * SLOT_H + 2 * INNER_GAP + 2 * OUTER_GAP,
      5 * SLOT_H + 3 * INNER_GAP + 2 * OUTER_GAP,
      6 * SLOT_H + 3 * INNER_GAP + 3 * OUTER_GAP,
      7 * SLOT_H + 4 * INNER_GAP + 3 * OUTER_GAP,
    ]
    totalH = 8 * SLOT_H + 4 * INNER_GAP + 3 * OUTER_GAP

    const afM = mids(afTops)

    // QF-Tops: zentriert zwischen je 2 AF-Paaren
    qfTops = [
      centeredTop(afM[0], afM[1]),
      centeredTop(afM[2], afM[3]),
      centeredTop(afM[4], afM[5]),
      centeredTop(afM[6], afM[7]),
    ]
    const qfM = mids(qfTops)

    // HF-Tops: zentriert zwischen je 2 QF-Paaren
    hfTops = [centeredTop(qfM[0], qfM[1]), centeredTop(qfM[2], qfM[3])]
    const hfM = mids(hfTops)

    // Final-Top: zentriert zwischen HF-Paar
    finalTop = centeredTop(hfM[0], hfM[1])
    const finM = finalTop + half

    // Connector-Pairs
    afQfPairs = [
      { in1: afM[0], in2: afM[1], out: qfM[0] },
      { in1: afM[2], in2: afM[3], out: qfM[1] },
      { in1: afM[4], in2: afM[5], out: qfM[2] },
      { in1: afM[6], in2: afM[7], out: qfM[3] },
    ]
    qfHfPairs = [
      { in1: qfM[0], in2: qfM[1], out: hfM[0] },
      { in1: qfM[2], in2: qfM[3], out: hfM[1] },
    ]
    hfFinalPairs = [{ in1: hfM[0], in2: hfM[1], out: finM }]
  } else if (isVF) {
    // 4 QF-Slots: je 2 Slots pro HF.
    afTops = []
    qfTops = [
      0,
      SLOT_H + INNER_GAP,
      2 * SLOT_H + INNER_GAP + OUTER_GAP,
      3 * SLOT_H + 2 * INNER_GAP + OUTER_GAP,
    ]
    totalH = 4 * SLOT_H + 2 * INNER_GAP + OUTER_GAP

    const qfM = mids(qfTops)
    hfTops = [centeredTop(qfM[0], qfM[1]), centeredTop(qfM[2], qfM[3])]
    const hfM = mids(hfTops)
    finalTop = centeredTop(hfM[0], hfM[1])
    const finM = finalTop + half

    afQfPairs = []
    qfHfPairs = [
      { in1: qfM[0], in2: qfM[1], out: hfM[0] },
      { in1: qfM[2], in2: qfM[3], out: hfM[1] },
    ]
    hfFinalPairs = [{ in1: hfM[0], in2: hfM[1], out: finM }]
  } else {
    // HF-only
    afTops = []
    qfTops = []
    totalH = 2 * SLOT_H + INNER_GAP

    hfTops = [0, SLOT_H + INNER_GAP]
    const hfM = mids(hfTops)
    finalTop = centeredTop(hfM[0], hfM[1])
    const finM = finalTop + half

    afQfPairs = []
    qfHfPairs = []
    hfFinalPairs = [{ in1: hfM[0], in2: hfM[1], out: finM }]
  }

  // ── Gewinner-Teaser: zeigt erwartete Teilnehmer in noch leeren Slots ────────

  const qfPreviews: SlotPreview[] = isAF
    ? [
        { nameA: getWinnerName(af[0]), nameB: getWinnerName(af[1]) },
        { nameA: getWinnerName(af[2]), nameB: getWinnerName(af[3]) },
        { nameA: getWinnerName(af[4]), nameB: getWinnerName(af[5]) },
        { nameA: getWinnerName(af[6]), nameB: getWinnerName(af[7]) },
      ]
    : []

  const hfPreviews: SlotPreview[] =
    isAF || isVF
      ? [
          { nameA: getWinnerName(qf[0]), nameB: getWinnerName(qf[1]) },
          { nameA: getWinnerName(qf[2]), nameB: getWinnerName(qf[3]) },
        ]
      : []

  const finalPreview: SlotPreview = {
    nameA: getWinnerName(hf[0]),
    nameB: getWinnerName(hf[1]),
  }

  const labelClass =
    "text-center text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"

  return (
    <div className="space-y-8">
      {/* ── Visuelles Bracket ──────────────────────────────────────────── */}
      <div className="relative">
        <div className="overflow-x-auto">
          <div className="min-w-max">
            {/* Spaltenüberschriften */}
            <div className="mb-2 flex items-center">
              {isAF && (
                <>
                  <div style={{ width: SLOT_W }} className={labelClass}>
                    Achtelfinale
                  </div>
                  <div style={{ width: CONN_W }} />
                </>
              )}
              {(isAF || isVF) && (
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
              {isAF && (
                <>
                  <RoundCol
                    matches={Array.from({ length: 8 }, (_, i) => af[i])}
                    tops={afTops}
                    totalH={totalH}
                  />
                  <Connector height={totalH} pairs={afQfPairs} />
                </>
              )}
              {(isAF || isVF) && (
                <>
                  <RoundCol
                    matches={Array.from({ length: 4 }, (_, i) => qf[i])}
                    tops={qfTops}
                    totalH={totalH}
                    previews={qfPreviews}
                  />
                  <Connector height={totalH} pairs={qfHfPairs} />
                </>
              )}
              <RoundCol
                matches={[hf.at(0), hf.at(1)]}
                tops={hfTops}
                totalH={totalH}
                previews={hfPreviews}
              />
              <Connector height={totalH} pairs={hfFinalPairs} />
              <RoundCol
                matches={[fin ?? undefined]}
                tops={[finalTop]}
                totalH={totalH}
                previews={[finalPreview]}
              />
            </div>
          </div>
        </div>
        {/* Scroll-Hinweis: rechter Fade-Schatten (nur auf Mobile sichtbar) */}
        <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background to-transparent md:hidden" />
      </div>

      {/* ── Detailkarten ───────────────────────────────────────────────── */}
      {!compact && (
        <div className="space-y-6">
          {isAF && af.length > 0 && (
            <RoundDetail
              title="Achtelfinale"
              matches={af}
              isAdmin={isAdmin}
              shotsPerSeries={shotsPerSeries}
              playoffBestOf={playoffBestOf}
              finalePrimary={finalePrimary}
              finaleTiebreaker1={finaleTiebreaker1}
              finaleTiebreaker2={finaleTiebreaker2}
            />
          )}
          {(isAF || isVF) && qf.length > 0 && (
            <RoundDetail
              title="Viertelfinale"
              matches={qf}
              isAdmin={isAdmin}
              shotsPerSeries={shotsPerSeries}
              playoffBestOf={playoffBestOf}
              finalePrimary={finalePrimary}
              finaleTiebreaker1={finaleTiebreaker1}
              finaleTiebreaker2={finaleTiebreaker2}
            />
          )}
          {hf.length > 0 && (
            <RoundDetail
              title="Halbfinale"
              matches={hf}
              isAdmin={isAdmin}
              shotsPerSeries={shotsPerSeries}
              playoffBestOf={playoffBestOf}
              finalePrimary={finalePrimary}
              finaleTiebreaker1={finaleTiebreaker1}
              finaleTiebreaker2={finaleTiebreaker2}
            />
          )}
          {fin && (
            <RoundDetail
              title="Finale"
              matches={[fin]}
              isAdmin={isAdmin}
              shotsPerSeries={shotsPerSeries}
              playoffBestOf={playoffBestOf}
              finalePrimary={finalePrimary}
              finaleTiebreaker1={finaleTiebreaker1}
              finaleTiebreaker2={finaleTiebreaker2}
            />
          )}
        </div>
      )}
    </div>
  )
}

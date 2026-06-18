import { Document, Page, View, Text } from "@react-pdf/renderer"
import type { ReactElement } from "react"
import type { ScoringMode, ScoringType } from "@/generated/prisma/client"
import type { MatchupListItem } from "@/lib/matchups/types"
import type { BestOfStandingRow } from "@/lib/standings/queries"
import { duelOutcome, stechschussOutcome, resolveBestOf } from "@/lib/scoring/bestOf"
import type { DuelSeries } from "@/lib/scoring/bestOf"
import { formatDecimal1, formatRings } from "@/lib/series/scoring-format"
import { styles, PDF_COLORS } from "@/lib/pdf/styles"

// ─── Props ────────────────────────────────────────────────────────────────────

export interface BestOfSchedulePdfProps {
  leagueName: string
  disciplineName: string
  scoringType: ScoringType
  scoringMode: ScoringMode
  /** null = mixed competition (teilerFaktor applies per series) */
  disciplineId: string | null
  groupBestOf: number
  groupPlayAllDuels: boolean
  groupTiebreaker1: ScoringMode | null
  groupTiebreaker2: ScoringMode | null
  standings: BestOfStandingRow[]
  matchups: MatchupListItem[]
  generatedAt: Date
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(date: Date): string {
  return date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function rankBadgeColor(rank: number): string {
  if (rank === 1) return PDF_COLORS.gold
  if (rank === 2) return PDF_COLORS.silver
  if (rank === 3) return PDF_COLORS.orange
  return "#9ca3af"
}

/**
 * Derives the Satz result (Duell wins) for a completed matchup.
 * Returns e.g. "2:1" or "1:1 n. St." (decided by Stechschuss).
 * Returns null if the matchup is not complete or data is insufficient.
 */
function deriveSatzLabel(
  matchup: MatchupListItem,
  scoringMode: ScoringMode,
  disciplineId: string | null,
  groupBestOf: number,
  groupPlayAllDuels: boolean,
  groupTiebreaker1: ScoringMode | null,
  groupTiebreaker2: ScoringMode | null
): string | null {
  if (matchup.status !== "COMPLETED") return null
  if (!matchup.awayParticipant) return null

  const homeId = matchup.homeParticipant.id
  const awayId = matchup.awayParticipant.id
  const series = matchup.results

  // Group regular series by duelNumber into home/away pairs
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
      // For mixed competitions, teilerFaktor is stored in ringteiler already;
      // correctedTeiler = teiler × 1 is sufficient for outcome comparison since
      // both sides use the same factor — outcome only depends on relative values.
      const entry: DuelSeries = {
        rings: s.rings,
        correctedTeiler: s.teiler,
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

  const regularPairs = Array.from(regularByDuel.entries())
    .filter(([, pair]) => pair.home !== undefined && pair.away !== undefined)
    .sort(([a], [b]) => a - b)

  const tiebreakPairs = Array.from(tiebreakByDuel.entries())
    .filter(([, pair]) => pair.homeRings !== undefined && pair.awayRings !== undefined)
    .sort(([a], [b]) => a - b)

  if (regularPairs.length === 0 && tiebreakPairs.length === 0) return null

  const regularOutcomes = regularPairs.map(([, pair]) =>
    duelOutcome(pair.home!, pair.away!, scoringMode, groupTiebreaker1, groupTiebreaker2)
  )
  const tiebreakOutcomes = tiebreakPairs.map(([, pair]) =>
    stechschussOutcome(pair.homeRings!, pair.awayRings!)
  )

  const status = resolveBestOf(regularOutcomes, tiebreakOutcomes, {
    bestOf: groupBestOf,
    playAll: groupPlayAllDuels,
  })

  if (status.kind !== "complete") return null

  let homeWins = 0
  let awayWins = 0
  for (const o of regularOutcomes) {
    if (o === "A") homeWins++
    else if (o === "B") awayWins++
  }

  const wasStechschuss = tiebreakPairs.length > 0 && homeWins === awayWins

  if (wasStechschuss) {
    return `${homeWins}:${awayWins} n. St.`
  }
  return `${homeWins}:${awayWins}`
}

/**
 * Returns the neutral paring label.
 * For regular matchups: "Name A vs. Name B"
 * For BYE matchups: "Name A – spielfrei"
 */
function pairingLabel(matchup: MatchupListItem): string {
  const homeName = `${matchup.homeParticipant.firstName} ${matchup.homeParticipant.lastName}`
  if (!matchup.awayParticipant) {
    return `${homeName} – spielfrei`
  }
  const awayName = `${matchup.awayParticipant.firstName} ${matchup.awayParticipant.lastName}`
  return `${homeName} vs. ${awayName}`
}

// ─── Spaltenbreiten ───────────────────────────────────────────────────────────

// Standings table widths (A4 portrait, 40pt padding each side → 515pt usable)
// Pl. · Name · Begegn. · Siege · Niederl. · Satzverhältnis · Satzdiff. · bestes Erg.
const WS = {
  rank: 28,
  name: 140,
  played: 36,
  wins: 32,
  losses: 40,
  ratio: 52,
  diff: 40,
  best: 60,
}

// Schedule table widths
const WM = { pairing: 380, satz: 70, status: 65 }

// ─── Kopfzeile ────────────────────────────────────────────────────────────────

function PdfHeader({
  leagueName,
  disciplineName,
  generatedAt,
}: {
  leagueName: string
  disciplineName: string
  generatedAt: Date
}): ReactElement {
  return (
    <View style={styles.headerBlock}>
      <View style={styles.headerLeft}>
        <Text style={styles.headerTitle}>{leagueName}</Text>
        <Text style={styles.headerSubtitle}>{disciplineName} · Spielplan &amp; Tabelle</Text>
      </View>
      <Text style={styles.headerDate}>Erstellt: {formatDate(generatedAt)}</Text>
    </View>
  )
}

// ─── Tabelle ──────────────────────────────────────────────────────────────────

function BestOfStandingsSection({
  rows,
  scoringMode,
  scoringType,
}: {
  rows: BestOfStandingRow[]
  scoringMode: ScoringMode
  scoringType: ScoringType
}): ReactElement {
  const showRings = scoringMode === "RINGS" || scoringMode === "RINGS_DECIMAL"

  return (
    <View>
      <Text style={styles.sectionTitle}>Tabelle</Text>
      <View style={styles.table}>
        {/* Header */}
        <View style={styles.tableHeaderRow}>
          <Text style={[styles.tableHeaderCell, { width: WS.rank }]}>Pl.</Text>
          <Text style={[styles.tableHeaderCellLeft, { width: WS.name }]}>Name</Text>
          <Text style={[styles.tableHeaderCell, { width: WS.played }]}>Begegn.</Text>
          <Text style={[styles.tableHeaderCell, { width: WS.wins }]}>Siege</Text>
          <Text style={[styles.tableHeaderCell, { width: WS.losses }]}>Niederl.</Text>
          <Text style={[styles.tableHeaderCell, { width: WS.ratio }]}>Satzverhältnis</Text>
          <Text style={[styles.tableHeaderCell, { width: WS.diff }]}>Satzdiff.</Text>
          <Text style={[styles.tableHeaderCell, { width: WS.best }]}>
            {showRings ? "Best. Ringe" : "Best. RT"}
          </Text>
        </View>

        {/* Rows */}
        {rows.map((row, idx) => {
          const isAlt = idx % 2 === 1
          const name = `${row.lastName}, ${row.firstName}${row.withdrawn ? " (Zur.)" : ""}`
          const duelDiffLabel = row.duelDiff > 0 ? `+${row.duelDiff}` : String(row.duelDiff)

          return (
            <View
              key={row.participantId}
              wrap={false}
              style={[
                styles.tableRow,
                isAlt ? styles.tableRowAlt : {},
                row.withdrawn ? styles.tableRowWithdrawn : {},
              ]}
            >
              {/* Rang-Abzeichen */}
              <View style={{ width: WS.rank, alignItems: "center" }}>
                {!row.withdrawn && (
                  <View style={[styles.rankBadge, { backgroundColor: rankBadgeColor(row.rank) }]}>
                    <Text style={styles.rankBadgeText}>{row.rank}</Text>
                  </View>
                )}
              </View>
              <Text
                style={[
                  row.withdrawn ? styles.tableCellMuted : styles.tableCellLeft,
                  { width: WS.name },
                ]}
              >
                {name}
              </Text>
              <Text style={[styles.tableCell, { width: WS.played }]}>{row.played}</Text>
              <Text style={[styles.tableCell, { width: WS.wins }]}>{row.wins}</Text>
              <Text style={[styles.tableCell, { width: WS.losses }]}>{row.losses}</Text>
              <Text style={[styles.tableCell, { width: WS.ratio }]}>
                {row.duelsWon}:{row.duelsLost}
              </Text>
              <Text style={[styles.tableCell, { width: WS.diff }]}>{duelDiffLabel}</Text>
              <Text style={[styles.tableCell, { width: WS.best }]}>
                {showRings
                  ? formatRings(row.bestRings, scoringType)
                  : formatDecimal1(row.bestRingteiler)}
              </Text>
            </View>
          )
        })}
      </View>
    </View>
  )
}

// ─── Spielplan-Abschnitt ──────────────────────────────────────────────────────

function BestOfMatchupsSection({
  matchups,
  scoringMode,
  disciplineId,
  groupBestOf,
  groupPlayAllDuels,
  groupTiebreaker1,
  groupTiebreaker2,
}: {
  matchups: MatchupListItem[]
  scoringMode: ScoringMode
  disciplineId: string | null
  groupBestOf: number
  groupPlayAllDuels: boolean
  groupTiebreaker1: ScoringMode | null
  groupTiebreaker2: ScoringMode | null
}): ReactElement {
  // Flat list — no Spieltag grouping (dates are agreed individually in best-of single).
  const sorted = [...matchups].sort((a, b) => a.roundIndex - b.roundIndex)

  return (
    <View break>
      <Text style={styles.sectionTitle}>Spielplan</Text>
      <View style={styles.table}>
        {/* Header */}
        <View style={styles.tableHeaderRow}>
          <Text style={[styles.tableHeaderCellLeft, { width: WM.pairing }]}>Begegnung</Text>
          <Text style={[styles.tableHeaderCell, { width: WM.satz }]}>Satz</Text>
          <Text style={[styles.tableHeaderCell, { width: WM.status }]}>Status</Text>
        </View>

        {sorted.map((m, idx) => {
          const isAlt = idx % 2 === 1
          const isBye = !m.awayParticipant
          const isCompleted = m.status === "COMPLETED"

          const pairing = pairingLabel(m)
          const isWithdrawn = m.homeParticipant.withdrawn || (m.awayParticipant?.withdrawn ?? false)

          const satzLabel = isCompleted
            ? (deriveSatzLabel(
                m,
                scoringMode,
                disciplineId,
                groupBestOf,
                groupPlayAllDuels,
                groupTiebreaker1,
                groupTiebreaker2
              ) ?? "")
            : ""

          let statusText: string
          if (isWithdrawn) {
            statusText = "Zur."
          } else if (isBye) {
            statusText = "Freilos"
          } else if (isCompleted) {
            statusText = "Abg."
          } else {
            statusText = "Offen"
          }

          const isPending = m.status === "PENDING"

          return (
            <View
              key={m.id}
              wrap={false}
              style={[
                styles.tableRow,
                isAlt ? styles.tableRowAlt : {},
                isWithdrawn ? styles.tableRowWithdrawn : {},
                { alignItems: "center" },
              ]}
            >
              <Text
                style={[
                  isWithdrawn ? styles.tableCellMuted : styles.tableCellLeft,
                  { width: WM.pairing },
                ]}
              >
                {pairing}
              </Text>
              <Text
                style={[
                  styles.tableCellBold,
                  { width: WM.satz, color: isCompleted ? PDF_COLORS.dark : "#bbbbbb" },
                ]}
              >
                {satzLabel}
              </Text>
              <Text
                style={[isPending ? styles.statusPending : styles.statusDone, { width: WM.status }]}
              >
                {statusText}
              </Text>
            </View>
          )
        })}
      </View>
    </View>
  )
}

// ─── Dokument ─────────────────────────────────────────────────────────────────

export function BestOfSchedulePdf({
  leagueName,
  disciplineName,
  scoringType,
  scoringMode,
  disciplineId,
  groupBestOf,
  groupPlayAllDuels,
  groupTiebreaker1,
  groupTiebreaker2,
  standings,
  matchups,
  generatedAt,
}: BestOfSchedulePdfProps): ReactElement {
  return (
    <Document title={`${leagueName} – Spielplan`} author="Ringwerk" creator="Ringwerk">
      <Page size="A4" style={styles.page}>
        {/* Kopfzeile */}
        <PdfHeader
          leagueName={leagueName}
          disciplineName={disciplineName}
          generatedAt={generatedAt}
        />

        {/* Tabelle */}
        {standings.length > 0 && (
          <BestOfStandingsSection
            rows={standings}
            scoringMode={scoringMode}
            scoringType={scoringType}
          />
        )}

        {/* Spielplan */}
        {matchups.length > 0 && (
          <BestOfMatchupsSection
            matchups={matchups}
            scoringMode={scoringMode}
            disciplineId={disciplineId}
            groupBestOf={groupBestOf}
            groupPlayAllDuels={groupPlayAllDuels}
            groupTiebreaker1={groupTiebreaker1}
            groupTiebreaker2={groupTiebreaker2}
          />
        )}

        {/* Fußzeile */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{leagueName}</Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
              `Seite ${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  )
}

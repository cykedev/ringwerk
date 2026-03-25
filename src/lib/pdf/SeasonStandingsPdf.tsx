import { Document, Page, View, Text } from "@react-pdf/renderer"
import type { ReactElement } from "react"
import type { SeasonStandingsEntry } from "@/lib/scoring/calculateSeasonStandings"
import { styles, PDF_COLORS } from "@/lib/pdf/styles"

// ─── Typen ────────────────────────────────────────────────────────────────────

export interface SeasonStandingsPdfProps {
  competitionName: string
  disciplineName: string | null
  seasonStart: Date | null
  seasonEnd: Date | null
  scoringMode: string
  shotsPerSeries: number
  minSeries: number | null
  isMixed: boolean
  entries: SeasonStandingsEntry[]
  generatedAt: Date
}

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

function formatDate(date: Date): string {
  return date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })
}

const SCORING_MODE_LABELS: Record<string, string> = {
  RINGTEILER: "Ringteiler",
  RINGS: "Ringe",
  RINGS_DECIMAL: "Ringe (Zehntel)",
  TEILER: "Teiler",
  DECIMAL_REST: "Dezimalrest",
  TARGET_ABSOLUTE: "Zielwert absolut",
  TARGET_UNDER: "Zielwert unter",
}

function formatRings(value: number | null): string {
  if (value === null) return "–"
  return value.toFixed(0)
}

function formatTeiler(value: number | null): string {
  if (value === null) return "–"
  return value.toFixed(1)
}

function formatRingteiler(value: number | null): string {
  if (value === null) return "–"
  return value.toFixed(1)
}

function withRank(value: string, rank: number | null): string {
  if (rank === null || value === "–") return value
  return `${rank}. · ${value}`
}

// ─── Spaltenbreiten (Portrait A4, 515pt nutzbar) ──────────────────────────────
// Mit Serien-Spalte (minSeries gesetzt):    name=155, series=45, rings=105, teiler=105, ringteiler=105 → 515
// Ohne Serien-Spalte (minSeries null):      name=200,            rings=105, teiler=105, ringteiler=105 → 515

const W_WITH_SERIES = { name: 155, series: 45, rings: 105, teiler: 105, ringteiler: 105 }
const W_NO_SERIES = { name: 200, rings: 105, teiler: 105, ringteiler: 105 }

// ─── Standings-Tabelle ────────────────────────────────────────────────────────

function StandingsTable({
  entries,
  minSeries,
  isMixed,
}: {
  entries: SeasonStandingsEntry[]
  minSeries: number | null
  isMixed: boolean
}): ReactElement {
  const hasSeries = minSeries !== null
  const teilerLabel = isMixed ? "Best. Teiler korr." : "Best. Teiler"

  return (
    <View style={styles.table}>
      {/* Header */}
      <View style={styles.tableHeaderRow}>
        {hasSeries ? (
          <>
            <Text style={[styles.tableHeaderCellLeft, { width: W_WITH_SERIES.name }]}>Name</Text>
            <Text style={[styles.tableHeaderCell, { width: W_WITH_SERIES.series }]}>Serien</Text>
            <Text style={[styles.tableHeaderCell, { width: W_WITH_SERIES.rings }]}>
              Beste Ringe
            </Text>
            <Text style={[styles.tableHeaderCell, { width: W_WITH_SERIES.teiler }]}>
              {teilerLabel}
            </Text>
            <Text style={[styles.tableHeaderCell, { width: W_WITH_SERIES.ringteiler }]}>
              Best. Ringteiler
            </Text>
          </>
        ) : (
          <>
            <Text style={[styles.tableHeaderCellLeft, { width: W_NO_SERIES.name }]}>Name</Text>
            <Text style={[styles.tableHeaderCell, { width: W_NO_SERIES.rings }]}>Beste Ringe</Text>
            <Text style={[styles.tableHeaderCell, { width: W_NO_SERIES.teiler }]}>
              {teilerLabel}
            </Text>
            <Text style={[styles.tableHeaderCell, { width: W_NO_SERIES.ringteiler }]}>
              Best. Ringteiler
            </Text>
          </>
        )}
      </View>

      {/* Zeilen */}
      {entries.map((entry, idx) => {
        const isAlt = idx % 2 === 1
        const dimmed = !entry.meetsMinSeries
        const rowStyle = dimmed ? styles.tableRowWithdrawn : {}

        const seriesText =
          hasSeries && minSeries !== null
            ? dimmed
              ? `${entry.seriesCount}/${minSeries}`
              : `${entry.seriesCount}`
            : null

        const ringsText = withRank(formatRings(entry.bestRings), entry.bestRings_rank)
        const teilerText = withRank(formatTeiler(entry.bestCorrectedTeiler), entry.bestTeiler_rank)
        const ringteilerText = withRank(
          formatRingteiler(entry.bestRingteiler),
          entry.bestRingteiler_rank
        )

        if (hasSeries) {
          return (
            <View
              key={entry.participantId}
              wrap={false}
              style={[styles.tableRow, isAlt ? styles.tableRowAlt : {}, rowStyle]}
            >
              <Text style={[styles.tableCellLeft, { width: W_WITH_SERIES.name }]}>
                {entry.participantName}
              </Text>
              <Text
                style={[styles.tableCell, { width: W_WITH_SERIES.series, color: PDF_COLORS.muted }]}
              >
                {seriesText}
              </Text>
              <Text style={[styles.tableCellBold, { width: W_WITH_SERIES.rings }]}>
                {ringsText}
              </Text>
              <Text
                style={[
                  styles.tableCellBold,
                  { width: W_WITH_SERIES.teiler, color: PDF_COLORS.muted },
                ]}
              >
                {teilerText}
              </Text>
              <Text style={[styles.tableCellBold, { width: W_WITH_SERIES.ringteiler }]}>
                {ringteilerText}
              </Text>
            </View>
          )
        }

        return (
          <View
            key={entry.participantId}
            wrap={false}
            style={[styles.tableRow, isAlt ? styles.tableRowAlt : {}, rowStyle]}
          >
            <Text style={[styles.tableCellLeft, { width: W_NO_SERIES.name }]}>
              {entry.participantName}
            </Text>
            <Text style={[styles.tableCellBold, { width: W_NO_SERIES.rings }]}>{ringsText}</Text>
            <Text
              style={[styles.tableCellBold, { width: W_NO_SERIES.teiler, color: PDF_COLORS.muted }]}
            >
              {teilerText}
            </Text>
            <Text style={[styles.tableCellBold, { width: W_NO_SERIES.ringteiler }]}>
              {ringteilerText}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

// ─── Dokument ─────────────────────────────────────────────────────────────────

export function SeasonStandingsPdf({
  competitionName,
  disciplineName,
  seasonStart,
  seasonEnd,
  scoringMode,
  shotsPerSeries,
  minSeries,
  isMixed,
  entries,
  generatedAt,
}: SeasonStandingsPdfProps): ReactElement {
  const disciplineDisplay = disciplineName ?? "Gemischt"

  let seasonRange = ""
  if (seasonStart) {
    seasonRange = formatDate(seasonStart)
    if (seasonEnd) seasonRange += ` – ${formatDate(seasonEnd)}`
  }

  return (
    <Document title={`${competitionName} – Rangliste`} author="Ringwerk" creator="Ringwerk">
      <Page size="A4" style={styles.page}>
        {/* Kopfzeile */}
        <View style={styles.headerBlock}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>{competitionName}</Text>
            <Text style={styles.headerSubtitle}>
              {disciplineDisplay}
              {seasonRange ? ` · ${seasonRange}` : ""} · Rangliste
            </Text>
          </View>
          <Text style={styles.headerDate}>Erstellt: {formatDate(generatedAt)}</Text>
        </View>

        {/* Config-Zeile */}
        <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
          <Text style={{ fontSize: 9, color: PDF_COLORS.muted }}>
            {SCORING_MODE_LABELS[scoringMode] ?? scoringMode}
          </Text>
          <Text style={{ fontSize: 9, color: PDF_COLORS.muted }}>{shotsPerSeries} Schuss</Text>
          {minSeries !== null && (
            <Text style={{ fontSize: 9, color: PDF_COLORS.muted }}>
              Mindest: {minSeries} Serien
            </Text>
          )}
        </View>

        {/* Rangliste */}
        {entries.length === 0 ? (
          <Text style={{ fontSize: 10, color: PDF_COLORS.muted }}>
            Noch keine Ergebnisse erfasst.
          </Text>
        ) : (
          <StandingsTable entries={entries} minSeries={minSeries} isMixed={isMixed} />
        )}

        {/* Fußzeile */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{competitionName}</Text>
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

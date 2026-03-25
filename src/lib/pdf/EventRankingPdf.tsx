import { Document, Page, View, Text } from "@react-pdf/renderer"
import type { ReactElement } from "react"
import type { EventRankedEntry } from "@/lib/scoring/rankEventParticipants"
import { styles, PDF_COLORS } from "@/lib/pdf/styles"

// ─── Typen ────────────────────────────────────────────────────────────────────

export interface EventRankingPdfProps {
  competitionName: string
  disciplineName: string | null
  eventDate: Date | null
  scoringMode: string
  shotsPerSeries: number
  targetValue: number | null
  isMixed: boolean
  entries: EventRankedEntry[]
  generatedAt: Date
}

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

function formatDate(date: Date): string {
  return date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function rankBadgeColor(rank: number): string {
  if (rank === 1) return PDF_COLORS.gold
  if (rank === 2) return PDF_COLORS.silver
  if (rank === 3) return PDF_COLORS.orange
  return "#374151"
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

const SCORE_LABEL: Record<string, string> = {
  RINGTEILER: "Ringteiler",
  RINGS: "Ringe",
  RINGS_DECIMAL: "Ringe",
  TEILER: "Teiler",
  DECIMAL_REST: "Dezimalrest",
  TARGET_ABSOLUTE: "Abweichung",
  TARGET_UNDER: "Abweichung",
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

// ─── Spaltenbreiten (Portrait A4, 515pt nutzbar) ──────────────────────────────
// Mit Disziplin-Spalte (isMixed): rank=28, name=130, disc=90, rings=55, teiler=65, score=65 → 433
// Ohne Disziplin-Spalte:          rank=28, name=200,           rings=65, teiler=75, score=75 → 443

const W_MIXED = { rank: 28, name: 130, disc: 90, rings: 55, teiler: 65, score: 65 }
const W_SINGLE = { rank: 28, name: 200, rings: 65, teiler: 90, score: 90 }

// ─── Ranglisten-Tabelle ───────────────────────────────────────────────────────

function RankingTable({
  entries,
  scoringMode,
  isMixed,
}: {
  entries: EventRankedEntry[]
  scoringMode: string
  isMixed: boolean
}): ReactElement {
  const scoreLabel = SCORE_LABEL[scoringMode] ?? "Score"
  const teilerLabel = isMixed ? "Teiler korr." : "Teiler"
  const W = isMixed ? W_MIXED : W_SINGLE

  return (
    <View style={styles.table}>
      {/* Header */}
      <View style={styles.tableHeaderRow}>
        <Text style={[styles.tableHeaderCell, { width: W.rank }]}>Pl.</Text>
        <Text style={[styles.tableHeaderCellLeft, { width: W.name }]}>Name</Text>
        {isMixed && (
          <Text style={[styles.tableHeaderCellLeft, { width: W_MIXED.disc }]}>Disziplin</Text>
        )}
        <Text style={[styles.tableHeaderCell, { width: W.rings }]}>Ringe</Text>
        <Text style={[styles.tableHeaderCell, { width: W.teiler }]}>{teilerLabel}</Text>
        <Text style={[styles.tableHeaderCell, { width: W.score }]}>{scoreLabel}</Text>
      </View>

      {/* Zeilen */}
      {entries.map((entry, idx) => {
        const isAlt = idx % 2 === 1
        const nameText = entry.isGuest ? `${entry.participantName} (Gast)` : entry.participantName
        const teilerValue = isMixed ? entry.correctedTeiler.toFixed(1) : entry.teiler.toFixed(1)

        return (
          <View
            key={entry.seriesId}
            wrap={false}
            style={[styles.tableRow, isAlt ? styles.tableRowAlt : {}]}
          >
            {/* Rang-Abzeichen */}
            <View style={{ width: W.rank, alignItems: "center" }}>
              <View style={[styles.rankBadge, { backgroundColor: rankBadgeColor(entry.rank) }]}>
                <Text style={styles.rankBadgeText}>{entry.rank}</Text>
              </View>
            </View>

            <Text style={[styles.tableCellLeft, { width: W.name }]}>{nameText}</Text>

            {isMixed && (
              <Text
                style={[styles.tableCellLeft, { width: W_MIXED.disc, color: PDF_COLORS.muted }]}
              >
                {entry.disciplineName}
              </Text>
            )}

            <Text style={[styles.tableCell, { width: W.rings }]}>{entry.rings}</Text>
            <Text style={[styles.tableCell, { width: W.teiler, color: PDF_COLORS.muted }]}>
              {teilerValue}
            </Text>
            <Text style={[styles.tableCellBold, { width: W.score }]}>
              {formatScore(entry.score, scoringMode)}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

// ─── Dokument ─────────────────────────────────────────────────────────────────

export function EventRankingPdf({
  competitionName,
  disciplineName,
  eventDate,
  scoringMode,
  shotsPerSeries,
  targetValue,
  isMixed,
  entries,
  generatedAt,
}: EventRankingPdfProps): ReactElement {
  const disciplineDisplay = disciplineName ?? "Gemischt"

  return (
    <Document title={`${competitionName} – Rangliste`} author="Ringwerk" creator="Ringwerk">
      <Page size="A4" style={styles.page}>
        {/* Kopfzeile */}
        <View style={styles.headerBlock}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>{competitionName}</Text>
            <Text style={styles.headerSubtitle}>
              {disciplineDisplay}
              {eventDate ? ` · ${formatDate(eventDate)}` : ""} · Rangliste
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
          {targetValue != null && (
            <Text style={{ fontSize: 9, color: PDF_COLORS.muted }}>Zielwert: {targetValue}</Text>
          )}
        </View>

        {/* Rangliste */}
        {entries.length === 0 ? (
          <Text style={{ fontSize: 10, color: PDF_COLORS.muted }}>
            Noch keine Ergebnisse erfasst.
          </Text>
        ) : (
          <RankingTable entries={entries} scoringMode={scoringMode} isMixed={isMixed} />
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

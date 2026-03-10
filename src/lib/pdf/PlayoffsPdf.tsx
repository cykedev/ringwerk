import { Document, Page, View, Text, Svg, Line, G } from "@react-pdf/renderer"
import type { ReactElement } from "react"
import type { PlayoffBracketData, PlayoffMatchItem, PlayoffDuelItem } from "@/lib/playoffs/types"
import { styles, PDF_COLORS } from "@/lib/pdf/styles"

// ─── Typen ────────────────────────────────────────────────────────────────────

export interface PlayoffsPdfProps {
  leagueName: string
  disciplineName: string
  bracket: PlayoffBracketData
  generatedAt: Date
}

// ─── Bracket-Koordinaten (identisch zu PlayoffBracket.tsx) ────────────────────

const SLOT_H = 80
const SLOT_W = 176
const CONN_W = 28
const PAIR_GAP = 32

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

function formatDate(date: Date): string {
  return date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function roundLabel(round: string): string {
  switch (round) {
    case "QUARTER_FINAL":
      return "Viertelfinale"
    case "SEMI_FINAL":
      return "Halbfinale"
    case "FINAL":
      return "Finale"
    default:
      return round
  }
}

function roundColor(round: string): string {
  switch (round) {
    case "FINAL":
      return PDF_COLORS.gold
    case "SEMI_FINAL":
      return PDF_COLORS.silver
    default:
      return PDF_COLORS.orange
  }
}

function winnerOf(match: PlayoffMatchItem): "A" | "B" | null {
  if (match.winsA > match.winsB) return "A"
  if (match.winsB > match.winsA) return "B"
  return null
}

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
        <Text style={styles.headerSubtitle}>{disciplineName} · Playoffs</Text>
      </View>
      <Text style={styles.headerDate}>Erstellt: {formatDate(generatedAt)}</Text>
    </View>
  )
}

// ─── Bracket-Karte (react-pdf View, kein SVG) ─────────────────────────────────

function BracketCard({ match }: { match: PlayoffMatchItem | undefined }): ReactElement {
  const halfH = SLOT_H / 2

  if (!match) {
    return (
      <View
        style={{
          width: SLOT_W,
          height: SLOT_H,
          borderWidth: 1,
          borderColor: "#cccccc",
          borderStyle: "dashed",
          borderRadius: 4,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: 8, color: "#aaaaaa" }}>Ausstehend</Text>
      </View>
    )
  }

  const winner = winnerOf(match)
  const color = roundColor(match.round)

  const participants = [
    { p: match.participantA, wins: match.winsA, side: "A" as const },
    { p: match.participantB, wins: match.winsB, side: "B" as const },
  ]

  return (
    <View
      style={{
        width: SLOT_W,
        height: SLOT_H,
        borderWidth: 1,
        borderColor: "#cccccc",
        borderRadius: 4,
        overflow: "hidden",
      }}
    >
      {participants.map(({ p, wins, side }, i) => {
        const isWinner = winner === side
        return (
          <View
            key={side}
            style={{
              height: halfH,
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 6,
              backgroundColor: isWinner ? "#f0faf4" : "#ffffff",
              borderTopWidth: i === 1 ? 1 : 0,
              borderTopColor: "#eeeeee",
              borderTopStyle: "solid",
            }}
          >
            <Text
              style={{
                flex: 1,
                fontSize: 8,
                fontFamily: isWinner ? "Helvetica-Bold" : "Helvetica",
                color: isWinner ? color : "#444444",
              }}
            >
              {p.firstName} {p.lastName}
            </Text>
            <Text
              style={{
                fontSize: 11,
                fontFamily: "Helvetica-Bold",
                color: isWinner ? color : "#888888",
                width: 18,
                textAlign: "right",
              }}
            >
              {wins}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

// ─── SVG-Connector (nur Linien) ───────────────────────────────────────────────

function ConnectorLines({
  isVF,
  totalW,
  totalH,
  xConnQF,
  xHF,
  xConnHF,
  xFinal,
  qfMids,
  hfMids,
  finalMid,
}: {
  isVF: boolean
  totalW: number
  totalH: number
  xConnQF: number
  xHF: number
  xConnHF: number
  xFinal: number
  qfMids: number[]
  hfMids: number[]
  finalMid: number
}): ReactElement {
  const midQF = xConnQF + CONN_W / 2
  const midHF = xConnHF + CONN_W / 2

  return (
    <Svg style={{ position: "absolute", top: 0, left: 0 }} width={totalW} height={totalH}>
      <G stroke="#cccccc" strokeWidth={1.5} fill="none">
        {/* QF → HF (nur bei Viertelfinale) */}
        {isVF && (
          <G>
            {/* Gruppe 1: QF[0]+QF[1] → HF[0] */}
            <Line x1={xConnQF} y1={qfMids[0]} x2={midQF} y2={qfMids[0]} />
            <Line x1={xConnQF} y1={qfMids[1]} x2={midQF} y2={qfMids[1]} />
            <Line x1={midQF} y1={qfMids[0]} x2={midQF} y2={qfMids[1]} />
            <Line x1={midQF} y1={hfMids[0]} x2={xHF} y2={hfMids[0]} />
            {/* Gruppe 2: QF[2]+QF[3] → HF[1] */}
            <Line x1={xConnQF} y1={qfMids[2]} x2={midQF} y2={qfMids[2]} />
            <Line x1={xConnQF} y1={qfMids[3]} x2={midQF} y2={qfMids[3]} />
            <Line x1={midQF} y1={qfMids[2]} x2={midQF} y2={qfMids[3]} />
            <Line x1={midQF} y1={hfMids[1]} x2={xHF} y2={hfMids[1]} />
          </G>
        )}

        {/* HF → Finale */}
        <Line x1={xConnHF} y1={hfMids[0]} x2={midHF} y2={hfMids[0]} />
        <Line x1={xConnHF} y1={hfMids[1]} x2={midHF} y2={hfMids[1]} />
        <Line x1={midHF} y1={hfMids[0]} x2={midHF} y2={hfMids[1]} />
        <Line x1={midHF} y1={finalMid} x2={xFinal} y2={finalMid} />
      </G>
    </Svg>
  )
}

// ─── Bracket-Layout (View-basiert mit SVG-Connector-Overlay) ──────────────────

function BracketLayout({ bracket }: { bracket: PlayoffBracketData }): ReactElement {
  const { quarterFinals: qf, semiFinals: hf, final: fin } = bracket
  const isVF = qf.length > 0

  const totalH = isVF ? 4 * SLOT_H + PAIR_GAP : 2 * SLOT_H + PAIR_GAP

  // X-Positionen
  const xQF = 0
  const xConnQF = SLOT_W
  const xHF = isVF ? SLOT_W + CONN_W : 0
  const xConnHF = xHF + SLOT_W
  const xFinal = xConnHF + CONN_W
  const totalW = isVF ? 3 * SLOT_W + 2 * CONN_W : 2 * SLOT_W + CONN_W

  // Y-Positionen (identisch zu PlayoffBracket.tsx)
  const qfTops = [0, SLOT_H, 2 * SLOT_H + PAIR_GAP, 3 * SLOT_H + PAIR_GAP]
  const hfTops = isVF ? [SLOT_H / 2, 2.5 * SLOT_H + PAIR_GAP] : [0, SLOT_H + PAIR_GAP]
  const finalTop = isVF ? 1.5 * SLOT_H + PAIR_GAP / 2 : SLOT_H / 2 + PAIR_GAP / 2

  // Mittelpunkte für Connector-Linien
  const qfMids = qfTops.map((t) => t + SLOT_H / 2)
  const hfMids = hfTops.map((t) => t + SLOT_H / 2)
  const finalMid = finalTop + SLOT_H / 2

  const labelStyle = {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#888888",
    textAlign: "center" as const,
  }

  return (
    <View>
      {/* Spalten-Beschriftungen */}
      <View style={{ flexDirection: "row", marginBottom: 8 }}>
        {isVF && <Text style={[labelStyle, { width: SLOT_W }]}>VIERTELFINALE</Text>}
        {isVF && <View style={{ width: CONN_W }} />}
        <Text style={[labelStyle, { width: SLOT_W }]}>HALBFINALE</Text>
        <View style={{ width: CONN_W }} />
        <Text style={[labelStyle, { width: SLOT_W }]}>FINALE</Text>
      </View>

      {/* Bracket-Körper: absolute positionierte Cards + SVG-Linien-Overlay */}
      <View style={{ position: "relative", width: totalW, height: totalH }}>
        {/* SVG nur für Connector-Linien */}
        <ConnectorLines
          isVF={isVF}
          totalW={totalW}
          totalH={totalH}
          xConnQF={xConnQF}
          xHF={xHF}
          xConnHF={xConnHF}
          xFinal={xFinal}
          qfMids={qfMids}
          hfMids={hfMids}
          finalMid={finalMid}
        />

        {/* QF-Karten */}
        {isVF &&
          [0, 1, 2, 3].map((i) => (
            <View key={i} style={{ position: "absolute", top: qfTops[i], left: xQF }}>
              <BracketCard match={qf[i]} />
            </View>
          ))}

        {/* HF-Karten */}
        {[0, 1].map((i) => (
          <View key={i} style={{ position: "absolute", top: hfTops[i], left: xHF }}>
            <BracketCard match={hf[i]} />
          </View>
        ))}

        {/* Finale */}
        <View style={{ position: "absolute", top: finalTop, left: xFinal }}>
          <BracketCard match={fin ?? undefined} />
        </View>
      </View>
    </View>
  )
}

// ─── Duel-Detail-Tabellen ─────────────────────────────────────────────────────

function duelWinnerLabel(duel: PlayoffDuelItem, match: PlayoffMatchItem): string {
  if (!duel.winnerId) return "Unentschieden"
  if (duel.winnerId === match.participantA.id) {
    return `${match.participantA.firstName} ${match.participantA.lastName}`
  }
  return `${match.participantB.firstName} ${match.participantB.lastName}`
}

function duelResultText(duel: PlayoffDuelItem, isFinal: boolean): string {
  if (!duel.isCompleted) return "Ausstehend"
  if (!duel.resultA || !duel.resultB) return "—"

  if (isFinal) {
    return `${duel.resultA.totalRings.toFixed(0)} R  vs  ${duel.resultB.totalRings.toFixed(0)} R`
  }
  const rtA = duel.resultA.ringteiler?.toFixed(1) ?? "—"
  const rtB = duel.resultB.ringteiler?.toFixed(1) ?? "—"
  return `RT ${rtA}  vs  RT ${rtB}`
}

function MatchDetail({
  match,
  index,
  total,
}: {
  match: PlayoffMatchItem
  index: number
  total: number
}): ReactElement {
  const isFinal = match.round === "FINAL"
  const winner = winnerOf(match)
  const winnerName =
    winner === "A"
      ? `${match.participantA.firstName} ${match.participantA.lastName}`
      : winner === "B"
        ? `${match.participantB.firstName} ${match.participantB.lastName}`
        : null

  // Immer Nummer anzeigen, wenn mehr als ein Match in der Runde
  const suffix = total > 1 ? ` ${index + 1}` : ""
  const title = `${roundLabel(match.round)}${suffix}`
  const score = `${match.winsA} : ${match.winsB}`
  const color = roundColor(match.round)

  return (
    <View style={{ marginBottom: 10 }} wrap={false}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 4,
        }}
      >
        <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", color: "#1a1a1a" }}>
          {title}: {match.participantA.firstName} {match.participantA.lastName} vs.{" "}
          {match.participantB.firstName} {match.participantB.lastName} — {score}
        </Text>
        {winnerName && (
          <Text style={{ fontSize: 9, color, fontFamily: "Helvetica-Bold" }}>
            Sieger: {winnerName}
          </Text>
        )}
      </View>

      <View style={styles.table}>
        <View style={styles.tableHeaderRow}>
          <Text style={[styles.tableHeaderCell, { width: 50 }]}>Duell</Text>
          <Text style={[styles.tableHeaderCell, { width: 160 }]}>Ergebnis</Text>
          <Text style={[styles.tableHeaderCellLeft, { flex: 1 }]}>Entscheidung</Text>
        </View>

        {match.duels.map((duel, idx) => (
          <View key={duel.id} style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}>
            <Text style={[styles.tableCell, { width: 50, fontSize: 9 }]}>
              {duel.isSuddenDeath ? "Verl." : `Duell ${duel.duelNumber}`}
            </Text>
            <Text style={[styles.tableCell, { width: 160, fontSize: 9 }]}>
              {duelResultText(duel, isFinal)}
            </Text>
            <Text style={[styles.tableCellLeft, { flex: 1, fontSize: 9 }]}>
              {duel.isCompleted ? duelWinnerLabel(duel, match) : "—"}
            </Text>
          </View>
        ))}
      </View>
    </View>
  )
}

function DetailSection({ bracket }: { bracket: PlayoffBracketData }): ReactElement {
  const { quarterFinals: qf, semiFinals: hf, final: fin } = bracket

  return (
    <View>
      <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Ergebnisse im Detail</Text>

      {qf.length > 0 && (
        <View style={{ marginBottom: 8 }}>
          <Text
            style={[
              styles.sectionSubtitle,
              { marginBottom: 6, fontFamily: "Helvetica-Bold", color: PDF_COLORS.orange },
            ]}
          >
            Viertelfinale
          </Text>
          {qf.map((m, i) => (
            <MatchDetail key={m.id} match={m} index={i} total={qf.length} />
          ))}
        </View>
      )}

      {hf.length > 0 && (
        <View style={{ marginBottom: 8 }}>
          <Text
            style={[
              styles.sectionSubtitle,
              { marginBottom: 6, fontFamily: "Helvetica-Bold", color: PDF_COLORS.silver },
            ]}
          >
            Halbfinale
          </Text>
          {hf.map((m, i) => (
            <MatchDetail key={m.id} match={m} index={i} total={hf.length} />
          ))}
        </View>
      )}

      {fin && (
        <View>
          <Text
            style={[
              styles.sectionSubtitle,
              { marginBottom: 6, fontFamily: "Helvetica-Bold", color: PDF_COLORS.gold },
            ]}
          >
            Finale
          </Text>
          <MatchDetail match={fin} index={0} total={1} />
        </View>
      )}
    </View>
  )
}

// ─── Dokument ─────────────────────────────────────────────────────────────────

export function PlayoffsPdf({
  leagueName,
  disciplineName,
  bracket,
  generatedAt,
}: PlayoffsPdfProps): ReactElement {
  return (
    <Document title={`${leagueName} – Playoffs`} author="Liga-App" creator="Liga-App">
      {/* Seite 1: Bracket (Querformat) */}
      <Page size="A4" orientation="landscape" style={styles.pageLandscape}>
        <PdfHeader
          leagueName={leagueName}
          disciplineName={disciplineName}
          generatedAt={generatedAt}
        />
        <BracketLayout bracket={bracket} />
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{leagueName} · Playoffs</Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
              `Seite ${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>

      {/* Seite 2+: Ergebnisse im Detail (Hochformat) */}
      <Page size="A4" style={styles.page}>
        <PdfHeader
          leagueName={leagueName}
          disciplineName={disciplineName}
          generatedAt={generatedAt}
        />
        <DetailSection bracket={bracket} />
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{leagueName} · Playoffs</Text>
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

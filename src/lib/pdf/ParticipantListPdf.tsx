import { Document, Page, View, Text } from "@react-pdf/renderer"
import type { ReactElement } from "react"
import { styles } from "@/lib/pdf/styles"

const W = { name: 200, disziplin: 115, einlage: 60, teilnahme: 70, geschossen: 70 }
const EMPTY_ROWS = 10

function formatDate(date: Date): string {
  return date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function Checkbox(): ReactElement {
  return <View style={styles.checkbox} />
}

function PdfHeader({ generatedAt }: { generatedAt: Date }): ReactElement {
  return (
    <View style={styles.headerBlock}>
      <View style={styles.headerLeft}>
        <Text style={styles.headerTitle}>Teilnehmerliste</Text>
        <Text style={styles.headerSubtitle}>Aktive Vereinsmitglieder</Text>
      </View>
      <Text style={styles.headerDate}>Erstellt: {formatDate(generatedAt)}</Text>
    </View>
  )
}

export interface ParticipantListPdfProps {
  participants: { firstName: string; lastName: string }[]
  generatedAt: Date
}

export function ParticipantListPdf({
  participants,
  generatedAt,
}: ParticipantListPdfProps): ReactElement {
  return (
    <Document title="Teilnehmerliste" author="Ringwerk" creator="Ringwerk">
      <Page size="A4" style={styles.page}>
        <PdfHeader generatedAt={generatedAt} />

        <View style={styles.table}>
          {/* Kopfzeile */}
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderCellLeft, { width: W.name }]}>Name</Text>
            <Text style={[styles.tableHeaderCellLeft, { width: W.disziplin }]}>Disziplin</Text>
            <Text style={[styles.tableHeaderCell, { width: W.einlage }]}>Einlage</Text>
            <Text style={[styles.tableHeaderCell, { width: W.teilnahme }]}>Teilnahme</Text>
            <Text style={[styles.tableHeaderCell, { width: W.geschossen }]}>Hat geschossen</Text>
          </View>

          {/* Teilnehmer-Zeilen */}
          {participants.map((p, idx) => (
            <View
              key={`${p.lastName}-${p.firstName}-${idx}`}
              wrap={false}
              style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}
            >
              <Text style={[styles.tableCellLeft, { width: W.name }]}>
                {p.lastName}, {p.firstName}
              </Text>
              <Text style={[styles.tableCellLeft, { width: W.disziplin }]}> </Text>
              <Text style={[styles.tableCell, { width: W.einlage }]}> </Text>
              <View style={{ width: W.teilnahme, alignItems: "center" }}>
                <Checkbox />
              </View>
              <View style={{ width: W.geschossen, alignItems: "center" }}>
                <Checkbox />
              </View>
            </View>
          ))}

          {/* Leerzeilen für Spontanstarter */}
          {Array.from({ length: EMPTY_ROWS }).map((_, i) => (
            <View
              key={`empty-${i}`}
              wrap={false}
              style={[styles.tableRow, { backgroundColor: "#fafafa" }]}
            >
              <Text style={[styles.tableCellLeft, { width: W.name }]}> </Text>
              <Text style={[styles.tableCellLeft, { width: W.disziplin }]}> </Text>
              <Text style={[styles.tableCell, { width: W.einlage }]}> </Text>
              <View style={{ width: W.teilnahme, alignItems: "center" }}>
                <Checkbox />
              </View>
              <View style={{ width: W.geschossen, alignItems: "center" }}>
                <Checkbox />
              </View>
            </View>
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Teilnehmerliste</Text>
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

export type AuditEventType =
  | "PARTICIPANT_WITHDRAWN"
  | "WITHDRAWAL_REVOKED"
  | "RESULT_ENTERED"
  | "RESULT_CORRECTED"
  | "PLAYOFF_RESULT_ENTERED"
  | "PLAYOFF_RESULT_CORRECTED"
  | "PLAYOFF_DUEL_DELETED"
  | "PLAYOFFS_STARTED"

export const AUDIT_EVENT_LABELS: Record<string, string> = {
  PARTICIPANT_WITHDRAWN: "Teilnehmer zurückgezogen",
  WITHDRAWAL_REVOKED: "Rückzug widerrufen",
  RESULT_ENTERED: "Ergebnis erfasst",
  RESULT_CORRECTED: "Ergebnis korrigiert",
  PLAYOFF_RESULT_ENTERED: "Playoff-Ergebnis erfasst",
  PLAYOFF_RESULT_CORRECTED: "Playoff-Ergebnis korrigiert",
  PLAYOFF_DUEL_DELETED: "Playoff-Duell gelöscht",
  PLAYOFFS_STARTED: "Playoffs gestartet",
}

export type AuditEventCategory = "participant" | "result" | "playoff" | "destructive"

export const AUDIT_EVENT_CATEGORY: Record<string, AuditEventCategory> = {
  PARTICIPANT_WITHDRAWN: "participant",
  WITHDRAWAL_REVOKED: "participant",
  RESULT_ENTERED: "result",
  RESULT_CORRECTED: "result",
  PLAYOFF_RESULT_ENTERED: "playoff",
  PLAYOFF_RESULT_CORRECTED: "playoff",
  PLAYOFF_DUEL_DELETED: "destructive",
  PLAYOFFS_STARTED: "playoff",
}

const ROUND_LABELS: Record<string, string> = {
  FIRST_LEG: "Hinrunde",
  SECOND_LEG: "Rückrunde",
  QUARTER_FINAL: "Viertelfinale",
  SEMI_FINAL: "Halbfinale",
  FINAL: "Finale",
}

type DetailRow = { label: string; value: string }

export function formatAuditDetails(eventType: string, details: unknown): DetailRow[] {
  if (!details || typeof details !== "object") return []
  const d = details as Record<string, unknown>
  const rows: DetailRow[] = []

  const str = (v: unknown) => (v == null ? "–" : String(v))
  const rings = (v: unknown) => (v == null ? "–" : `${v} Ringe`)
  const teiler = (v: unknown) => (v == null ? "–" : String(v))

  switch (eventType) {
    case "PARTICIPANT_WITHDRAWN":
      rows.push({ label: "Name", value: str(d.name) })
      if (d.reason) rows.push({ label: "Grund", value: str(d.reason) })
      break

    case "WITHDRAWAL_REVOKED":
      rows.push({ label: "Name", value: str(d.name) })
      break

    case "RESULT_ENTERED":
    case "RESULT_CORRECTED":
      if (d.homeName) rows.push({ label: "Heim", value: str(d.homeName) })
      rows.push({ label: "Heim – Ringe", value: rings(d.homeTotalRings) })
      rows.push({ label: "Heim – Teiler", value: teiler(d.homeTeiler) })
      if (d.awayName) rows.push({ label: "Gast", value: str(d.awayName) })
      rows.push({ label: "Gast – Ringe", value: rings(d.awayTotalRings) })
      rows.push({ label: "Gast – Teiler", value: teiler(d.awayTeiler) })
      break

    case "PLAYOFF_RESULT_ENTERED":
    case "PLAYOFF_RESULT_CORRECTED":
      rows.push({ label: "Runde", value: ROUND_LABELS[str(d.round)] ?? str(d.round) })
      rows.push({ label: "Duell Nr.", value: str(d.duelNumber) })
      if (d.nameA) rows.push({ label: "Schütze A", value: str(d.nameA) })
      rows.push({ label: "Schütze A – Ringe", value: rings(d.totalRingsA) })
      if (d.teilerA != null) rows.push({ label: "Schütze A – Teiler", value: teiler(d.teilerA) })
      if (d.nameB) rows.push({ label: "Schütze B", value: str(d.nameB) })
      rows.push({ label: "Schütze B – Ringe", value: rings(d.totalRingsB) })
      if (d.teilerB != null) rows.push({ label: "Schütze B – Teiler", value: teiler(d.teilerB) })
      break

    case "PLAYOFF_DUEL_DELETED":
      rows.push({ label: "Runde", value: ROUND_LABELS[str(d.round)] ?? str(d.round) })
      rows.push({ label: "Duell Nr.", value: str(d.duelNumber) })
      if (d.wasCompleted) {
        if (d.nameA) rows.push({ label: "Schütze A", value: str(d.nameA) })
        rows.push({ label: "Schütze A – Ringe", value: rings(d.totalRingsA) })
        if (d.teilerA != null) rows.push({ label: "Schütze A – Teiler", value: teiler(d.teilerA) })
        if (d.nameB) rows.push({ label: "Schütze B", value: str(d.nameB) })
        rows.push({ label: "Schütze B – Ringe", value: rings(d.totalRingsB) })
        if (d.teilerB != null) rows.push({ label: "Schütze B – Teiler", value: teiler(d.teilerB) })
      }
      break

    case "PLAYOFFS_STARTED":
      rows.push({ label: "Teilnehmer", value: str(d.participantCount) })
      break
  }

  return rows
}

export function getAuditDescription(eventType: string, details: unknown): string | null {
  if (!details || typeof details !== "object") return null
  const d = details as Record<string, unknown>
  const s = (v: unknown) => String(v)

  switch (eventType) {
    case "PARTICIPANT_WITHDRAWN":
    case "WITHDRAWAL_REVOKED":
      return d.name ? s(d.name) : null

    case "RESULT_ENTERED":
    case "RESULT_CORRECTED":
      if (d.homeName && d.awayName) {
        const roundLabel = d.round ? `${ROUND_LABELS[s(d.round)] ?? s(d.round)}: ` : ""
        return `${roundLabel}${s(d.homeName)} vs. ${s(d.awayName)}`
      }
      return null

    case "PLAYOFF_RESULT_ENTERED":
    case "PLAYOFF_RESULT_CORRECTED":
    case "PLAYOFF_DUEL_DELETED":
      if (d.nameA && d.nameB) {
        const roundLabel = d.round ? `${ROUND_LABELS[s(d.round)] ?? s(d.round)}: ` : ""
        return `${roundLabel}${s(d.nameA)} vs. ${s(d.nameB)}`
      }
      return null

    case "PLAYOFFS_STARTED":
      return d.participantCount ? `${s(d.participantCount)} Teilnehmer` : null

    default:
      return null
  }
}

import { determineOutcome } from "@/lib/results/calculateResult"

export interface StandingsParticipant {
  id: string
  firstName: string
  lastName: string
  /** true = in dieser Liga zurückgezogen (LeagueParticipant.status === WITHDRAWN) */
  withdrawn: boolean
}

export interface StandingsMatchupResult {
  participantId: string
  totalRings: number
  teiler: number
  ringteiler: number
}

export interface StandingsMatchup {
  id: string
  status: "PENDING" | "COMPLETED" | "BYE" | "WALKOVER"
  homeParticipantId: string
  awayParticipantId: string | null
  results: StandingsMatchupResult[]
}

export interface StandingRow {
  participantId: string
  firstName: string
  lastName: string
  withdrawn: boolean
  played: number
  wins: number
  draws: number
  losses: number
  byes: number
  points: number
  /** Niedrigster Ringteiler aus allen gewerteten Duellen. null wenn noch keine. */
  bestRingteiler: number | null
  rank: number
}

interface ParticipantStats {
  wins: number
  draws: number
  losses: number
  byes: number
  played: number
  ringteilers: number[]
}

/**
 * Berechnet die Ligatabelle aus Teilnehmern und Paarungen.
 * Sortierreihenfolge:
 *   1. Zurückgezogene Teilnehmer immer ans Ende
 *   2. Punkte absteigend (Sieg=2, Unentschieden=1, Freilos=2)
 *   3. Direkter Vergleich (Punkte aus Kopf-an-Kopf-Duellen der Gruppe)
 *   4. Bester Ringteiler (niedrigster Wert) aufsteigend
 *   5. Nachname alphabetisch (Stabilisierung)
 *
 * Matchups mit mindestens einem zurückgezogenen Teilnehmer werden nicht gewertet.
 */
export function calculateStandings(
  participants: StandingsParticipant[],
  matchups: StandingsMatchup[]
): StandingRow[] {
  const withdrawnIds = new Set(participants.filter((p) => p.withdrawn).map((p) => p.id))

  const statsMap = new Map<string, ParticipantStats>()
  for (const p of participants) {
    statsMap.set(p.id, { wins: 0, draws: 0, losses: 0, byes: 0, played: 0, ringteilers: [] })
  }

  for (const matchup of matchups) {
    const homeWithdrawn = withdrawnIds.has(matchup.homeParticipantId)
    const awayWithdrawn = matchup.awayParticipantId
      ? withdrawnIds.has(matchup.awayParticipantId)
      : false

    if (matchup.status === "BYE") {
      // Freilos zählt nur wenn Teilnehmer nicht zurückgezogen
      if (!homeWithdrawn) {
        statsMap.get(matchup.homeParticipantId)!.byes++
      }
      continue
    }

    if (matchup.status !== "COMPLETED") continue
    // Paarungen mit zurückgezogenem Teilnehmer werden nicht gewertet
    if (homeWithdrawn || awayWithdrawn) continue

    const homeResult = matchup.results.find((r) => r.participantId === matchup.homeParticipantId)
    const awayResult = matchup.results.find((r) => r.participantId === matchup.awayParticipantId)
    if (!homeResult || !awayResult) continue

    const outcome = determineOutcome(homeResult, awayResult)

    const homeStats = statsMap.get(matchup.homeParticipantId)!
    const awayStats = statsMap.get(matchup.awayParticipantId!)!

    homeStats.played++
    awayStats.played++
    homeStats.ringteilers.push(homeResult.ringteiler)
    awayStats.ringteilers.push(awayResult.ringteiler)

    if (outcome === "HOME_WIN") {
      homeStats.wins++
      awayStats.losses++
    } else if (outcome === "AWAY_WIN") {
      awayStats.wins++
      homeStats.losses++
    } else {
      homeStats.draws++
      awayStats.draws++
    }
  }

  const rows: StandingRow[] = participants.map((p) => {
    const s = statsMap.get(p.id)!
    const points = s.wins * 2 + s.draws + s.byes * 2
    const bestRingteiler = s.ringteilers.length > 0 ? Math.min(...s.ringteilers) : null
    return {
      participantId: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      withdrawn: p.withdrawn,
      played: s.played,
      wins: s.wins,
      draws: s.draws,
      losses: s.losses,
      byes: s.byes,
      points,
      bestRingteiler,
      rank: 0,
    }
  })

  const active = rows.filter((r) => !r.withdrawn)
  const withdrawn = rows.filter((r) => r.withdrawn)

  const sorted = sortWithDirectComparison(active, matchups, withdrawnIds)

  sorted.forEach((r, i) => {
    r.rank = i + 1
  })
  withdrawn.forEach((r) => {
    r.rank = sorted.length + 1
  })

  return [...sorted, ...withdrawn]
}

/**
 * Sortiert eine Gruppe aktiver Teilnehmer unter Berücksichtigung des direkten Vergleichs.
 * Bei Punktgleichstand werden Kopf-an-Kopf-Punkte innerhalb der Gruppe berechnet.
 */
function sortWithDirectComparison(
  rows: StandingRow[],
  matchups: StandingsMatchup[],
  withdrawnIds: Set<string>
): StandingRow[] {
  // Gruppen mit gleicher Punktzahl bilden
  const pointGroups = new Map<number, StandingRow[]>()
  for (const row of rows) {
    const group = pointGroups.get(row.points) ?? []
    group.push(row)
    pointGroups.set(row.points, group)
  }

  const result: StandingRow[] = []
  const sortedPoints = [...pointGroups.keys()].sort((a, b) => b - a)

  for (const points of sortedPoints) {
    const group = pointGroups.get(points)!

    if (group.length === 1) {
      result.push(group[0])
      continue
    }

    // Direkter Vergleich: Punkte aus Duellen nur zwischen Teilnehmern dieser Gruppe
    const groupIds = new Set(group.map((r) => r.participantId))
    const directPoints = new Map<string, number>()

    for (const row of group) {
      let dp = 0
      for (const m of matchups) {
        if (m.status !== "COMPLETED" || !m.awayParticipantId) continue
        if (withdrawnIds.has(m.homeParticipantId) || withdrawnIds.has(m.awayParticipantId)) continue
        // Nur Duelle zwischen Teilnehmern dieser Punktegruppe
        if (!groupIds.has(m.homeParticipantId) || !groupIds.has(m.awayParticipantId)) continue

        const isHome = m.homeParticipantId === row.participantId
        const isAway = m.awayParticipantId === row.participantId
        if (!isHome && !isAway) continue

        const homeResult = m.results.find((r) => r.participantId === m.homeParticipantId)
        const awayResult = m.results.find((r) => r.participantId === m.awayParticipantId)
        if (!homeResult || !awayResult) continue

        const outcome = determineOutcome(homeResult, awayResult)
        if (outcome === "DRAW") {
          dp += 1
        } else if ((isHome && outcome === "HOME_WIN") || (isAway && outcome === "AWAY_WIN")) {
          dp += 2
        }
      }
      directPoints.set(row.participantId, dp)
    }

    group.sort((a, b) => {
      const dpDiff =
        (directPoints.get(b.participantId) ?? 0) - (directPoints.get(a.participantId) ?? 0)
      if (dpDiff !== 0) return dpDiff

      const rtA = a.bestRingteiler ?? Infinity
      const rtB = b.bestRingteiler ?? Infinity
      if (rtA !== rtB) return rtA - rtB

      return a.lastName.localeCompare(b.lastName, "de")
    })

    result.push(...group)
  }

  return result
}

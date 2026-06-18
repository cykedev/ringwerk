import type { ScoringMode } from "@/generated/prisma/client"
import {
  duelOutcome,
  resolveBestOf,
  stechschussOutcome,
  type DuelOutcome,
} from "@/lib/scoring/bestOf"
import { effectiveTeilerFaktor } from "@/lib/scoring/calculateScore"

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface BestOfStandingsParticipant {
  id: string
  firstName: string
  lastName: string
  withdrawn: boolean
}

export interface BestOfStandingsSeries {
  participantId: string
  duelNumber: number
  isTiebreak: boolean
  rings: number
  teiler: number
  /** stored (already effective-factor-corrected at save time). */
  ringteiler: number
  /** the discipline's configured factor. */
  teilerFaktor: number
}

export interface BestOfStandingsMatchup {
  homeParticipantId: string
  awayParticipantId: string | null // null = BYE
  series: BestOfStandingsSeries[]
}

export interface BestOfStandingsConfig {
  scoringMode: ScoringMode
  bestOf: number
  playAll: boolean
  tiebreaker1: ScoringMode | null
  tiebreaker2: ScoringMode | null
  /** Competition.disciplineId — null = mixed (factor active), else fixed (factor 1). */
  competitionDisciplineId: string | null
}

// ---------------------------------------------------------------------------
// Output type
// ---------------------------------------------------------------------------

export interface BestOfStandingRow {
  participantId: string
  firstName: string
  lastName: string
  withdrawn: boolean
  played: number
  wins: number
  losses: number
  duelsWon: number
  duelsLost: number
  duelDiff: number
  bestRingteiler: number | null
  bestRings: number | null
  rank: number
}

// ---------------------------------------------------------------------------
// Internal stat accumulator
// ---------------------------------------------------------------------------

interface ParticipantStats {
  wins: number
  losses: number
  played: number
  duelsWon: number
  duelsLost: number
  ringteilers: number[]
  ringsValues: number[]
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

export function calculateBestOfStandings(
  participants: BestOfStandingsParticipant[],
  matchups: BestOfStandingsMatchup[],
  config: BestOfStandingsConfig
): BestOfStandingRow[] {
  const withdrawnIds = new Set(participants.filter((p) => p.withdrawn).map((p) => p.id))

  // Initialise stats for every participant.
  const statsMap = new Map<string, ParticipantStats>()
  for (const p of participants) {
    statsMap.set(p.id, {
      wins: 0,
      losses: 0,
      played: 0,
      duelsWon: 0,
      duelsLost: 0,
      ringteilers: [],
      ringsValues: [],
    })
  }

  // We need to remember decided matchups for the direct-comparison step.
  // Each entry records: who were home/away and who won.
  const decidedMatchups: DecidedMatchupRecord[] = []

  for (const matchup of matchups) {
    // Skip BYEs.
    if (matchup.awayParticipantId === null) continue

    const { homeParticipantId: homeId, awayParticipantId: awayId } = matchup

    // Skip matchups involving withdrawn participants.
    if (withdrawnIds.has(homeId) || withdrawnIds.has(awayId)) continue

    // Separate regular from tiebreak series.
    const regularSeries = matchup.series.filter((s) => !s.isTiebreak)
    const tiebreakSeries = matchup.series.filter((s) => s.isTiebreak)

    // Group regular series by duelNumber → compute outcomes using full duelOutcome.
    const regularByDuel = groupByDuelNumber(regularSeries, homeId, awayId)
    const regularOutcomes: DuelOutcome[] = sortedDuelNumbers(regularByDuel).map((dn) => {
      const { home, away } = regularByDuel.get(dn)!
      return duelOutcome(
        toDuelSeries(home, config.competitionDisciplineId),
        toDuelSeries(away, config.competitionDisciplineId),
        config.scoringMode,
        config.tiebreaker1,
        config.tiebreaker2
      )
    })

    // Group tiebreak (Stechschuss) series by duelNumber → decided purely by shot value (rings).
    const tiebreakByDuel = groupByDuelNumber(tiebreakSeries, homeId, awayId)
    const tiebreakOutcomes: DuelOutcome[] = sortedDuelNumbers(tiebreakByDuel).map((dn) => {
      const { home, away } = tiebreakByDuel.get(dn)!
      return stechschussOutcome(home.rings, away.rings)
    })

    // Resolve the match.
    const status = resolveBestOf(regularOutcomes, tiebreakOutcomes, {
      bestOf: config.bestOf,
      playAll: config.playAll,
    })

    // Only count completed matches.
    if (status.kind !== "complete") continue

    const homeStats = statsMap.get(homeId)!
    const awayStats = statsMap.get(awayId)!

    homeStats.played++
    awayStats.played++

    if (status.winner === "A") {
      homeStats.wins++
      awayStats.losses++
    } else {
      awayStats.wins++
      homeStats.losses++
    }

    // Tally duel wins/losses from regular outcomes only.
    for (const outcome of regularOutcomes) {
      if (outcome === "A") {
        homeStats.duelsWon++
        awayStats.duelsLost++
      } else if (outcome === "B") {
        awayStats.duelsWon++
        homeStats.duelsLost++
      }
      // TIE: no change
    }

    // Collect best-result data from each participant's regular series.
    for (const s of regularSeries) {
      const stats = statsMap.get(s.participantId)
      if (!stats) continue
      stats.ringteilers.push(s.ringteiler)
      stats.ringsValues.push(s.rings)
    }

    // Record this decided matchup for direct-comparison.
    decidedMatchups.push({ homeId, awayId, winner: status.winner })
  }

  // Build rows.
  const rows: BestOfStandingRow[] = participants.map((p) => {
    const s = statsMap.get(p.id)!
    const bestRingteiler = s.ringteilers.length > 0 ? Math.min(...s.ringteilers) : null
    const bestRings = s.ringsValues.length > 0 ? Math.max(...s.ringsValues) : null
    return {
      participantId: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      withdrawn: p.withdrawn,
      played: s.played,
      wins: s.wins,
      losses: s.losses,
      duelsWon: s.duelsWon,
      duelsLost: s.duelsLost,
      duelDiff: s.duelsWon - s.duelsLost,
      bestRingteiler,
      bestRings,
      rank: 0,
    }
  })

  const active = rows.filter((r) => !r.withdrawn)
  const withdrawn = rows.filter((r) => r.withdrawn)

  const sorted = sortWithDirectComparison(active, decidedMatchups, config.scoringMode)

  sorted.forEach((r, i) => {
    r.rank = i + 1
  })
  withdrawn.forEach((r) => {
    r.rank = sorted.length + 1
  })

  return [...sorted, ...withdrawn]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface DuelPair {
  home: BestOfStandingsSeries
  away: BestOfStandingsSeries
}

/** Build a corrected DuelSeries from a raw standings series entry. */
function toDuelSeries(s: BestOfStandingsSeries, competitionDisciplineId: string | null) {
  const factor = effectiveTeilerFaktor(competitionDisciplineId, s.teilerFaktor)
  return {
    rings: s.rings,
    correctedTeiler: s.teiler * factor,
    ringteiler: s.ringteiler,
  }
}

/**
 * Group series entries by duelNumber and pair home vs away.
 * Assumes each duelNumber has exactly one home and one away entry.
 */
function groupByDuelNumber(
  series: BestOfStandingsSeries[],
  homeId: string,
  awayId: string
): Map<number, DuelPair> {
  const map = new Map<number, DuelPair>()
  for (const s of series) {
    let pair = map.get(s.duelNumber)
    if (!pair) {
      pair = {} as DuelPair
      map.set(s.duelNumber, pair)
    }
    if (s.participantId === homeId) {
      pair.home = s
    } else if (s.participantId === awayId) {
      pair.away = s
    }
  }
  // Only return complete pairs (both home and away present).
  for (const [dn, pair] of map) {
    if (!pair.home || !pair.away) map.delete(dn)
  }
  return map
}

/** Return duel numbers sorted ascending. */
function sortedDuelNumbers(map: Map<number, DuelPair>): number[] {
  return [...map.keys()].sort((a, b) => a - b)
}

// ---------------------------------------------------------------------------
// Sort with direct comparison
// ---------------------------------------------------------------------------

interface DecidedMatchupRecord {
  homeId: string
  awayId: string
  winner: "A" | "B"
}

/**
 * Sorts active rows:
 *   1. wins desc
 *   2. Within tied wins group: direct match-wins counted only among group members
 *   3. duelDiff desc
 *   4. Best single result (mode-aware): RINGS/RINGS_DECIMAL → bestRings desc; else → bestRingteiler asc (null last)
 *   5. lastName localeCompare "de"
 */
function sortWithDirectComparison(
  rows: BestOfStandingRow[],
  decidedMatchups: DecidedMatchupRecord[],
  scoringMode: ScoringMode
): BestOfStandingRow[] {
  // Group by wins.
  const winsGroups = new Map<number, BestOfStandingRow[]>()
  for (const row of rows) {
    const group = winsGroups.get(row.wins) ?? []
    group.push(row)
    winsGroups.set(row.wins, group)
  }

  const result: BestOfStandingRow[] = []
  const sortedWins = [...winsGroups.keys()].sort((a, b) => b - a)

  for (const wins of sortedWins) {
    const group = winsGroups.get(wins)!

    if (group.length === 1) {
      result.push(group[0])
      continue
    }

    // Compute direct match-wins among the group.
    const groupIds = new Set(group.map((r) => r.participantId))
    const directWins = new Map<string, number>()
    for (const row of group) {
      directWins.set(row.participantId, 0)
    }

    for (const m of decidedMatchups) {
      // Only count matchups between participants in this group.
      if (!groupIds.has(m.homeId) || !groupIds.has(m.awayId)) continue
      const winnerId = m.winner === "A" ? m.homeId : m.awayId
      directWins.set(winnerId, (directWins.get(winnerId) ?? 0) + 1)
    }

    group.sort((a, b) => {
      // 2. Direct comparison
      const dwDiff = (directWins.get(b.participantId) ?? 0) - (directWins.get(a.participantId) ?? 0)
      if (dwDiff !== 0) return dwDiff

      // 3. duelDiff desc
      if (a.duelDiff !== b.duelDiff) return b.duelDiff - a.duelDiff

      // 4. Best single result (mode-aware)
      if (scoringMode === "RINGS" || scoringMode === "RINGS_DECIMAL") {
        const ra = a.bestRings ?? -Infinity
        const rb = b.bestRings ?? -Infinity
        if (ra !== rb) return rb - ra
      } else {
        const rta = a.bestRingteiler ?? Infinity
        const rtb = b.bestRingteiler ?? Infinity
        if (rta !== rtb) return rta - rtb
      }

      // 5. lastName alphabetical
      return a.lastName.localeCompare(b.lastName, "de")
    })

    result.push(...group)
  }

  return result
}

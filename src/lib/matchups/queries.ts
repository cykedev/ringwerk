import { db } from "@/lib/db"
import type { MatchupListItem, MatchupParticipant, ScheduleStatus } from "./types"

// Rohtyp aus Prisma-Select (inkl. verschachteltem LP-Status)
type RawParticipant = {
  id: string
  firstName: string
  lastName: string
  leagues: Array<{ status: string }>
}

function mapParticipant(p: RawParticipant): MatchupParticipant {
  return {
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    withdrawn: p.leagues[0]?.status === "WITHDRAWN",
  }
}

function participantSelect(leagueId: string) {
  return {
    id: true,
    firstName: true,
    lastName: true,
    leagues: {
      where: { leagueId },
      select: { status: true },
    },
  } as const
}

export async function getMatchupsForLeague(leagueId: string): Promise<MatchupListItem[]> {
  const rows = await db.matchup.findMany({
    where: { leagueId },
    select: {
      id: true,
      round: true,
      roundIndex: true,
      status: true,
      dueDate: true,
      homeParticipant: { select: participantSelect(leagueId) },
      awayParticipant: { select: participantSelect(leagueId) },
      results: {
        select: {
          participantId: true,
          totalRings: true,
          teiler: true,
          ringteiler: true,
        },
      },
    },
    orderBy: [{ round: "asc" }, { roundIndex: "asc" }, { homeParticipant: { lastName: "asc" } }],
  })

  return rows.map((row) => ({
    id: row.id,
    round: row.round,
    roundIndex: row.roundIndex,
    status: row.status,
    dueDate: row.dueDate,
    homeParticipant: mapParticipant(row.homeParticipant),
    awayParticipant: row.awayParticipant ? mapParticipant(row.awayParticipant) : null,
    // Decimal-Felder in number umwandeln (Prisma 7)
    results: row.results.map((r) => ({
      participantId: r.participantId,
      totalRings: r.totalRings.toNumber(),
      teiler: r.teiler.toNumber(),
      ringteiler: r.ringteiler.toNumber(),
    })),
  }))
}

export async function getScheduleStatus(leagueId: string): Promise<ScheduleStatus> {
  const [total, completed] = await Promise.all([
    db.matchup.count({ where: { leagueId } }),
    db.matchup.count({ where: { leagueId, status: "COMPLETED" } }),
  ])

  return {
    hasSchedule: total > 0,
    hasCompletedMatchups: completed > 0,
    totalMatchups: total,
  }
}

import { db } from "@/lib/db"
import type { LeagueParticipantListItem } from "@/lib/leagueParticipants/types"

/** Alle Einschreibungen einer Liga — ACTIVE zuerst, dann WITHDRAWN. */
export async function getLeagueParticipants(
  leagueId: string
): Promise<LeagueParticipantListItem[]> {
  return db.leagueParticipant.findMany({
    where: { leagueId },
    select: {
      id: true,
      leagueId: true,
      status: true,
      startNumber: true,
      withdrawnAt: true,
      participant: {
        select: { id: true, firstName: true, lastName: true, contact: true },
      },
    },
    orderBy: [{ status: "asc" }, { participant: { lastName: "asc" } }],
  })
}

import { db } from "@/lib/db"
import type { CompetitionParticipantListItem } from "@/lib/competitionParticipants/types"

/** Alle Einschreibungen eines Wettbewerbs — ACTIVE zuerst, dann WITHDRAWN. */
export async function getCompetitionParticipants(
  competitionId: string
): Promise<CompetitionParticipantListItem[]> {
  return db.competitionParticipant.findMany({
    where: { competitionId },
    select: {
      id: true,
      competitionId: true,
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

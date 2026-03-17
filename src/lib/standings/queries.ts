import { db } from "@/lib/db"
import { calculateStandings } from "./calculateStandings"
import type { StandingRow, StandingsMatchup, StandingsParticipant } from "./calculateStandings"

export type { StandingRow }

/** Berechnet und gibt die aktuelle Tabelle einer Meisterschaft zurück. */
export async function getStandingsForCompetition(competitionId: string): Promise<StandingRow[]> {
  const [enrollments, rawMatchups] = await Promise.all([
    db.competitionParticipant.findMany({
      where: { competitionId },
      select: {
        status: true,
        participant: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.matchup.findMany({
      where: { competitionId },
      select: {
        id: true,
        status: true,
        homeParticipantId: true,
        awayParticipantId: true,
        results: {
          select: {
            participantId: true,
            totalRings: true,
            teiler: true,
            ringteiler: true,
          },
        },
      },
    }),
  ])

  const participants: StandingsParticipant[] = enrollments.map((e) => ({
    id: e.participant.id,
    firstName: e.participant.firstName,
    lastName: e.participant.lastName,
    withdrawn: e.status === "WITHDRAWN",
  }))

  // Decimal-Felder in number umwandeln (Prisma 7 gibt Decimal-Objekte zurück)
  const matchups: StandingsMatchup[] = rawMatchups.map((m) => ({
    id: m.id,
    status: m.status,
    homeParticipantId: m.homeParticipantId,
    awayParticipantId: m.awayParticipantId,
    results: m.results.map((r) => ({
      participantId: r.participantId,
      totalRings: r.totalRings.toNumber(),
      teiler: r.teiler.toNumber(),
      ringteiler: r.ringteiler.toNumber(),
    })),
  }))

  return calculateStandings(participants, matchups)
}

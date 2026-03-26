import { db } from "@/lib/db"
import type { CompetitionDetail, CompetitionListItem } from "@/lib/competitions/types"
import type { EventSeriesItem, SeasonParticipantEntry, SeasonSeriesItem } from "@/lib/series/types"

const disciplineSelect = {
  id: true,
  name: true,
  scoringType: true,
  teilerFaktor: true,
} as const

const listSelect = {
  id: true,
  name: true,
  type: true,
  status: true,
  scoringMode: true,
  shotsPerSeries: true,
  discipline: { select: { id: true, name: true, scoringType: true } },
  hinrundeDeadline: true,
  rueckrundeDeadline: true,
  eventDate: true,
  allowGuests: true,
  teamSize: true,
  teamScoring: true,
  seasonStart: true,
  seasonEnd: true,
  createdAt: true,
  _count: { select: { participants: true } },
} as const

/** Alle aktiven Wettbewerbe mit Disziplin und Teilnehmeranzahl — für allgemeine Ansicht. */
export async function getCompetitions(): Promise<CompetitionListItem[]> {
  const rows = await db.competition.findMany({
    where: { status: "ACTIVE" },
    select: listSelect,
    orderBy: { name: "asc" },
  })
  return rows as unknown as CompetitionListItem[]
}

/** Alle Wettbewerbe (alle Status) — für Admin-Verwaltungsansicht. */
export async function getCompetitionsForManagement(): Promise<CompetitionListItem[]> {
  const rows = await db.competition.findMany({
    select: listSelect,
    orderBy: [{ status: "asc" }, { name: "asc" }],
  })
  return rows as unknown as CompetitionListItem[]
}

/** Einzelner Wettbewerb mit allen Feldern — für Edit-Seite und Detail-Pages. */
export async function getCompetitionById(id: string): Promise<CompetitionDetail | null> {
  const row = await db.competition.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      type: true,
      status: true,
      scoringMode: true,
      shotsPerSeries: true,
      disciplineId: true,
      discipline: { select: disciplineSelect },
      playoffBestOf: true,
      playoffHasViertelfinale: true,
      playoffHasAchtelfinale: true,
      finalePrimary: true,
      finaleTiebreaker1: true,
      finaleTiebreaker2: true,
      finaleHasSuddenDeath: true,
      hinrundeDeadline: true,
      rueckrundeDeadline: true,
      eventDate: true,
      allowGuests: true,
      teamSize: true,
      teamScoring: true,
      targetValue: true,
      targetValueType: true,
      minSeries: true,
      seasonStart: true,
      seasonEnd: true,
      createdAt: true,
      _count: { select: { matchups: true } },
    },
  })
  if (!row) return null
  return {
    ...row,
    discipline: row.discipline
      ? { ...row.discipline, teilerFaktor: row.discipline.teilerFaktor.toNumber() }
      : null,
    targetValue: row.targetValue ? row.targetValue.toNumber() : null,
  }
}

/** Event-Wettbewerb mit allen Serien (inkl. Teilnehmer + Disziplin) — für Rangliste. */
export async function getEventWithSeries(id: string): Promise<{
  competition: CompetitionDetail
  series: EventSeriesItem[]
} | null> {
  const competition = await getCompetitionById(id)
  if (!competition || competition.type !== "EVENT") return null

  const rows = await db.series.findMany({
    where: { competitionId: id },
    select: {
      id: true,
      participantId: true,
      competitionParticipantId: true,
      disciplineId: true,
      discipline: { select: { name: true, teilerFaktor: true } },
      participant: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          competitions: {
            where: { competitionId: id },
            select: { isGuest: true },
            take: 1,
          },
        },
      },
      // Team-Daten via direkte CP-Relation (neue Serien mit competitionParticipantId)
      competitionParticipant: {
        select: {
          isGuest: true,
          eventTeamId: true,
          eventTeam: { select: { teamNumber: true } },
        },
      },
      rings: true,
      teiler: true,
      ringteiler: true,
      shots: true,
      shotCount: true,
      sessionDate: true,
    },
    orderBy: { createdAt: "asc" },
  })

  const series: EventSeriesItem[] = rows.map((s) => ({
    id: s.id,
    participantId: s.participantId,
    competitionParticipantId: s.competitionParticipantId,
    disciplineId: s.disciplineId,
    discipline: { name: s.discipline.name, teilerFaktor: s.discipline.teilerFaktor.toNumber() },
    participant: {
      id: s.participant.id,
      firstName: s.participant.firstName,
      lastName: s.participant.lastName,
    },
    // CP-Relation hat Vorrang (neue Serien); Fallback auf alte Abfrage (bestehende Serien)
    isGuest: s.competitionParticipant?.isGuest ?? s.participant.competitions[0]?.isGuest ?? false,
    teamNumber: s.competitionParticipant?.eventTeam?.teamNumber ?? null,
    rings: s.rings.toNumber(),
    teiler: s.teiler.toNumber(),
    ringteiler: s.ringteiler.toNumber(),
    shots: Array.isArray(s.shots) ? (s.shots as string[]).map(Number) : [],
    shotCount: s.shotCount,
    sessionDate: s.sessionDate,
  }))

  return { competition, series }
}

/** Saison-Wettbewerb mit allen Teilnehmern und deren Serien — für Serien-Verwaltung und Rangliste. */
export async function getSeasonWithSeries(id: string): Promise<{
  competition: CompetitionDetail
  participants: SeasonParticipantEntry[]
} | null> {
  const competition = await getCompetitionById(id)
  if (!competition || competition.type !== "SEASON") return null

  const participants = await db.competitionParticipant.findMany({
    where: { competitionId: id },
    select: {
      participantId: true,
      status: true,
      disciplineId: true,
      discipline: { select: { id: true, name: true } },
      participant: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: [{ participant: { lastName: "asc" } }, { participant: { firstName: "asc" } }],
  })

  const seriesRows = await db.series.findMany({
    where: { competitionId: id },
    select: {
      id: true,
      participantId: true,
      disciplineId: true,
      discipline: { select: { name: true, teilerFaktor: true } },
      rings: true,
      teiler: true,
      ringteiler: true,
      shotCount: true,
      sessionDate: true,
    },
    orderBy: { sessionDate: "asc" },
  })

  // Serien nach Teilnehmer gruppieren
  const seriesByParticipant = new Map<string, SeasonSeriesItem[]>()
  for (const s of seriesRows) {
    const item: SeasonSeriesItem = {
      id: s.id,
      participantId: s.participantId,
      disciplineId: s.disciplineId,
      discipline: {
        name: s.discipline.name,
        teilerFaktor: s.discipline.teilerFaktor.toNumber(),
      },
      rings: s.rings.toNumber(),
      teiler: s.teiler.toNumber(),
      ringteiler: s.ringteiler.toNumber(),
      shotCount: s.shotCount,
      sessionDate: s.sessionDate,
    }
    const existing = seriesByParticipant.get(s.participantId) ?? []
    existing.push(item)
    seriesByParticipant.set(s.participantId, existing)
  }

  const result: SeasonParticipantEntry[] = participants.map((cp) => ({
    participantId: cp.participantId,
    firstName: cp.participant.firstName,
    lastName: cp.participant.lastName,
    status: cp.status,
    disciplineId: cp.disciplineId,
    discipline: cp.discipline,
    series: seriesByParticipant.get(cp.participantId) ?? [],
  }))

  return { competition, participants: result }
}

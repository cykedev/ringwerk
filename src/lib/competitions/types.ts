import type {
  CompetitionStatus,
  CompetitionType,
  ScoringMode,
  ScoringType,
  TargetValueType,
} from "@/generated/prisma/client"

export type CompetitionListItem = {
  id: string
  name: string
  type: CompetitionType
  status: CompetitionStatus
  scoringMode: ScoringMode
  shotsPerSeries: number
  discipline: {
    id: string
    name: string
    scoringType: ScoringType
  } | null
  // Liga
  hinrundeDeadline: Date | null
  rueckrundeDeadline: Date | null
  // Event
  eventDate: Date | null
  allowGuests: boolean | null
  // Saison
  seasonStart: Date | null
  seasonEnd: Date | null
  createdAt: Date
  _count: { participants: number }
}

export type CompetitionDetail = {
  id: string
  name: string
  type: CompetitionType
  status: CompetitionStatus
  scoringMode: ScoringMode
  shotsPerSeries: number
  disciplineId: string | null
  discipline: {
    id: string
    name: string
    scoringType: ScoringType
    teilerFaktor: number
  } | null
  // Liga – Regelset
  playoffBestOf: number | null
  playoffHasViertelfinale: boolean
  playoffHasAchtelfinale: boolean
  finalePrimary: ScoringMode
  finaleTiebreaker1: ScoringMode | null
  finaleTiebreaker2: ScoringMode | null
  finaleHasSuddenDeath: boolean | null
  // Liga – Deadlines
  hinrundeDeadline: Date | null
  rueckrundeDeadline: Date | null
  // Event
  eventDate: Date | null
  allowGuests: boolean | null
  teamSize: number | null
  targetValue: number | null
  targetValueType: TargetValueType | null
  // Saison
  minSeries: number | null
  seasonStart: Date | null
  seasonEnd: Date | null
  createdAt: Date
  _count: { matchups: number }
}

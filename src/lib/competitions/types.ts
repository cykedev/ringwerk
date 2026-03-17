import type { CompetitionStatus, ScoringType } from "@/generated/prisma/client"

export type CompetitionListItem = {
  id: string
  name: string
  status: CompetitionStatus
  discipline: {
    id: string
    name: string
    scoringType: ScoringType
  } | null
  hinrundeDeadline: Date | null
  rueckrundeDeadline: Date | null
  createdAt: Date
  _count: { participants: number }
}

export type CompetitionDetail = {
  id: string
  name: string
  status: CompetitionStatus
  disciplineId: string | null
  discipline: {
    id: string
    name: string
    scoringType: ScoringType
  } | null
  hinrundeDeadline: Date | null
  rueckrundeDeadline: Date | null
  createdAt: Date
}

import type { LeagueStatus, ScoringType } from "@/generated/prisma/client"

export type LeagueListItem = {
  id: string
  name: string
  status: LeagueStatus
  discipline: {
    id: string
    name: string
    scoringType: ScoringType
  }
  firstLegDeadline: Date | null
  secondLegDeadline: Date | null
  createdAt: Date
  _count: { participants: number }
}

export type LeagueDetail = {
  id: string
  name: string
  status: LeagueStatus
  disciplineId: string
  discipline: {
    id: string
    name: string
    scoringType: ScoringType
  }
  firstLegDeadline: Date | null
  secondLegDeadline: Date | null
  createdAt: Date
}

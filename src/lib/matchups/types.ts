import { MatchStatus, Round } from "@/generated/prisma/client"

export type { MatchStatus, Round }

export interface MatchupParticipant {
  id: string
  firstName: string
  lastName: string
  withdrawn: boolean
}

export interface MatchResultSummary {
  participantId: string
  rings: number
  teiler: number
  ringteiler: number
}

export interface MatchupListItem {
  id: string
  round: Round
  roundIndex: number
  status: MatchStatus
  dueDate: Date | null
  homeParticipant: MatchupParticipant
  awayParticipant: MatchupParticipant | null // null = BYE
  results: MatchResultSummary[]
}

export interface ScheduleStatus {
  hasSchedule: boolean
  hasCompletedMatchups: boolean
  totalMatchups: number
}

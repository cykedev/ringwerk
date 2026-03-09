import type { ScoringType } from "@/generated/prisma/client"

export type { ScoringType }

export interface ResultInput {
  totalRings: number
  teiler: number
}

export interface SaveMatchResultInput {
  homeResult: ResultInput
  awayResult: ResultInput
}

export interface MatchResultSummary {
  participantId: string
  totalRings: number
  teiler: number
  ringteiler: number
}

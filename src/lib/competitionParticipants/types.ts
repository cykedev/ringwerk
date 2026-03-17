import type { ParticipantStatus } from "@/generated/prisma/client"

export type CompetitionParticipantListItem = {
  id: string
  competitionId: string
  status: ParticipantStatus
  startNumber: number | null
  withdrawnAt: Date | null
  participant: {
    id: string
    firstName: string
    lastName: string
    contact: string
  }
}

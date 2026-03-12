export type ParticipantListItem = {
  id: string
  firstName: string
  lastName: string
  contact: string
  isActive: boolean
  createdAt: Date
  _count: { leagues: number }
}

export type ParticipantDetail = {
  id: string
  firstName: string
  lastName: string
  contact: string
  isActive: boolean
  createdAt: Date
}

export type ParticipantOption = {
  id: string
  firstName: string
  lastName: string
  contact: string
}

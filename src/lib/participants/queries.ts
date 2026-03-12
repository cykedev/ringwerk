import { db } from "@/lib/db"
import type {
  ParticipantDetail,
  ParticipantListItem,
  ParticipantOption,
} from "@/lib/participants/types"

/** Alle aktiven Teilnehmer — für allgemeine Ansicht. */
export async function getParticipants(): Promise<ParticipantListItem[]> {
  return db.participant.findMany({
    where: { isActive: true },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      contact: true,
      isActive: true,
      createdAt: true,
      _count: { select: { leagues: true } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  })
}

/** Alle Teilnehmer (aktiv + inaktiv) — für Admin-Verwaltungsansicht. */
export async function getParticipantsForManagement(): Promise<ParticipantListItem[]> {
  return db.participant.findMany({
    select: {
      id: true,
      firstName: true,
      lastName: true,
      contact: true,
      isActive: true,
      createdAt: true,
      _count: { select: { leagues: true } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  })
}

/** Einzelner Teilnehmer — für Edit-Seite. */
export async function getParticipantById(id: string): Promise<ParticipantDetail | null> {
  return db.participant.findUnique({
    where: { id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      contact: true,
      isActive: true,
      createdAt: true,
    },
  })
}

/** Aktive Teilnehmer, die noch nicht in der angegebenen Liga eingeschrieben sind. */
export async function getParticipantsNotInLeague(leagueId: string): Promise<ParticipantOption[]> {
  return db.participant.findMany({
    where: {
      isActive: true,
      leagues: { none: { leagueId } },
    },
    select: { id: true, firstName: true, lastName: true, contact: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  })
}

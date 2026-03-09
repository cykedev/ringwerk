import { db } from "@/lib/db"
import type { LeagueDetail, LeagueListItem } from "@/lib/leagues/types"

/** Alle aktiven Ligen mit Disziplin und Teilnehmeranzahl — für allgemeine Ansicht. */
export async function getLeagues(): Promise<LeagueListItem[]> {
  return db.league.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      status: true,
      discipline: { select: { id: true, name: true, scoringType: true } },
      firstLegDeadline: true,
      secondLegDeadline: true,
      createdAt: true,
      _count: { select: { participants: true } },
    },
    orderBy: { name: "asc" },
  })
}

/** Alle Ligen (alle Status) — für Admin-Verwaltungsansicht. */
export async function getLeaguesForManagement(): Promise<LeagueListItem[]> {
  return db.league.findMany({
    select: {
      id: true,
      name: true,
      status: true,
      discipline: { select: { id: true, name: true, scoringType: true } },
      firstLegDeadline: true,
      secondLegDeadline: true,
      createdAt: true,
      _count: { select: { participants: true } },
    },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  })
}

/** Einzelne Liga mit Disziplin — für Edit-Seite. */
export async function getLeagueById(id: string): Promise<LeagueDetail | null> {
  return db.league.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      status: true,
      disciplineId: true,
      discipline: { select: { id: true, name: true, scoringType: true } },
      firstLegDeadline: true,
      secondLegDeadline: true,
      createdAt: true,
    },
  })
}

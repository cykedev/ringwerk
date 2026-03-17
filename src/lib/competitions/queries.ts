import { db } from "@/lib/db"
import type { CompetitionDetail, CompetitionListItem } from "@/lib/competitions/types"

/** Alle aktiven Wettbewerbe mit Disziplin und Teilnehmeranzahl — für allgemeine Ansicht. */
export async function getCompetitions(): Promise<CompetitionListItem[]> {
  return db.competition.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      status: true,
      discipline: { select: { id: true, name: true, scoringType: true } },
      hinrundeDeadline: true,
      rueckrundeDeadline: true,
      createdAt: true,
      _count: { select: { participants: true } },
    },
    orderBy: { name: "asc" },
  })
}

/** Alle Wettbewerbe (alle Status) — für Admin-Verwaltungsansicht. */
export async function getCompetitionsForManagement(): Promise<CompetitionListItem[]> {
  return db.competition.findMany({
    select: {
      id: true,
      name: true,
      status: true,
      discipline: { select: { id: true, name: true, scoringType: true } },
      hinrundeDeadline: true,
      rueckrundeDeadline: true,
      createdAt: true,
      _count: { select: { participants: true } },
    },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  })
}

/** Einzelner Wettbewerb mit Disziplin — für Edit-Seite. */
export async function getCompetitionById(id: string): Promise<CompetitionDetail | null> {
  return db.competition.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      status: true,
      disciplineId: true,
      discipline: { select: { id: true, name: true, scoringType: true } },
      hinrundeDeadline: true,
      rueckrundeDeadline: true,
      createdAt: true,
    },
  })
}

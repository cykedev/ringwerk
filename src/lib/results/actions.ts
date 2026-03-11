"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { getAuthSession } from "@/lib/auth-helpers"
import type { ActionResult } from "@/lib/types"
import type { SaveMatchResultInput } from "./types"
import { calcRingteiler, MAX_RINGS } from "./calculateResult"

/**
 * Speichert das Ergebnis einer Paarung (beide Schützen).
 * Bestehende Ergebnisse werden überschrieben (Korrektur) → AuditLog-Eintrag.
 */
export async function saveMatchResult(
  matchupId: string,
  data: SaveMatchResultInput
): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet." }
  if (session.user.role !== "ADMIN") return { error: "Keine Berechtigung." }

  const matchup = await db.matchup.findUnique({
    where: { id: matchupId },
    select: {
      id: true,
      status: true,
      round: true,
      homeParticipantId: true,
      homeParticipant: { select: { firstName: true, lastName: true } },
      awayParticipantId: true,
      awayParticipant: { select: { firstName: true, lastName: true } },
      leagueId: true,
      league: { select: { discipline: { select: { scoringType: true } } } },
      results: { select: { id: true } },
    },
  })

  if (!matchup) return { error: "Paarung nicht gefunden." }
  if (matchup.status === "BYE") return { error: "Freilos-Paarungen haben keine Ergebnisse." }
  if (!matchup.awayParticipantId) return { error: "Ungültige Paarung: kein Gegner zugeordnet." }

  const maxRings = MAX_RINGS[matchup.league.discipline.scoringType]
  const homeRingteiler = calcRingteiler(
    maxRings,
    data.homeResult.totalRings,
    data.homeResult.teiler
  )
  const awayRingteiler = calcRingteiler(
    maxRings,
    data.awayResult.totalRings,
    data.awayResult.teiler
  )

  const isCorrection = matchup.results.length > 0

  try {
    await db.$transaction(async (tx) => {
      await tx.matchResult.upsert({
        where: {
          matchupId_participantId: {
            matchupId,
            participantId: matchup.homeParticipantId,
          },
        },
        create: {
          matchupId,
          participantId: matchup.homeParticipantId,
          totalRings: data.homeResult.totalRings,
          teiler: data.homeResult.teiler,
          ringteiler: homeRingteiler,
          importSource: "MANUAL",
          recordedByUserId: session.user.id,
        },
        update: {
          totalRings: data.homeResult.totalRings,
          teiler: data.homeResult.teiler,
          ringteiler: homeRingteiler,
          recordedByUserId: session.user.id,
        },
      })

      await tx.matchResult.upsert({
        where: {
          matchupId_participantId: {
            matchupId,
            participantId: matchup.awayParticipantId!,
          },
        },
        create: {
          matchupId,
          participantId: matchup.awayParticipantId!,
          totalRings: data.awayResult.totalRings,
          teiler: data.awayResult.teiler,
          ringteiler: awayRingteiler,
          importSource: "MANUAL",
          recordedByUserId: session.user.id,
        },
        update: {
          totalRings: data.awayResult.totalRings,
          teiler: data.awayResult.teiler,
          ringteiler: awayRingteiler,
          recordedByUserId: session.user.id,
        },
      })

      await tx.matchup.update({
        where: { id: matchupId },
        data: { status: "COMPLETED" },
      })
    })

    await db.auditLog.create({
      data: {
        eventType: isCorrection ? "RESULT_CORRECTED" : "RESULT_ENTERED",
        entityType: "MATCHUP",
        entityId: matchupId,
        userId: session.user.id,
        leagueId: matchup.leagueId,
        details: {
          round: matchup.round,
          homeName: `${matchup.homeParticipant.firstName} ${matchup.homeParticipant.lastName}`,
          homeTotalRings: data.homeResult.totalRings,
          homeTeiler: data.homeResult.teiler,
          awayName: `${matchup.awayParticipant!.firstName} ${matchup.awayParticipant!.lastName}`,
          awayTotalRings: data.awayResult.totalRings,
          awayTeiler: data.awayResult.teiler,
        },
      },
    })
  } catch (error) {
    console.error("Fehler beim Speichern des Ergebnisses:", error)
    return { error: "Ergebnis konnte nicht gespeichert werden." }
  }

  revalidatePath(`/leagues/${matchup.leagueId}/schedule`)
  revalidatePath(`/leagues/${matchup.leagueId}/standings`)

  return { success: true }
}

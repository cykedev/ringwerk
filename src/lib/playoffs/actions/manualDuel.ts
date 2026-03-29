"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { getAuthSession } from "@/lib/auth-helpers"
import type { ActionResult } from "@/lib/types"

/**
 * Legt das nächste Duell in einem PlayoffMatch an.
 * Wird für VF/HF aufgerufen wenn der Admin ein weiteres Duell starten will.
 */
export async function addPlayoffDuel(
  playoffMatchId: string
): Promise<ActionResult<{ duelId: string }>> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet." }
  if (session.user.role !== "ADMIN") return { error: "Keine Berechtigung." }

  const match = await db.playoffMatch.findUnique({
    where: { id: playoffMatchId },
    select: {
      id: true,
      status: true,
      competitionId: true,
      duels: { orderBy: { duelNumber: "desc" }, take: 1, select: { duelNumber: true } },
    },
  })

  if (!match) return { error: "Playoff-Paarung nicht gefunden." }
  if (match.status === "COMPLETED")
    return { error: "Diese Playoff-Paarung ist bereits abgeschlossen." }

  const nextDuelNumber = (match.duels[0]?.duelNumber ?? 0) + 1

  try {
    const duel = await db.playoffDuel.create({
      data: {
        playoffMatchId,
        duelNumber: nextDuelNumber,
        isSuddenDeath: false,
      },
      select: { id: true },
    })

    revalidatePath(`/competitions/${match.competitionId}/playoffs`)
    return { success: true, data: { duelId: duel.id } }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error("Fehler beim Anlegen des Duells:", msg)
    return { error: "Duell konnte nicht angelegt werden." }
  }
}

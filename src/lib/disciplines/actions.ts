"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { db } from "@/lib/db"
import { getAuthSession } from "@/lib/auth-helpers"
import type { ActionResult } from "@/lib/types"

const DisciplineSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich").max(100, "Name zu lang"),
  scoringType: z.enum(["WHOLE", "DECIMAL"] as const, { message: "Ungültige Wertungsart" }),
})

function revalidateDisciplinePaths(): void {
  revalidatePath("/disciplines")
  revalidatePath("/disciplines", "layout")
}

export async function createDiscipline(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet" }
  if (session.user.role !== "ADMIN") return { error: "Keine Berechtigung" }

  const parsed = DisciplineSchema.safeParse({
    name: formData.get("name"),
    scoringType: formData.get("scoringType"),
  })
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  await db.discipline.create({ data: parsed.data })
  revalidateDisciplinePaths()
  return { success: true }
}

export async function updateDiscipline(
  id: string,
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet" }
  if (session.user.role !== "ADMIN") return { error: "Keine Berechtigung" }

  const discipline = await db.discipline.findUnique({
    where: { id },
    select: { id: true, scoringType: true },
  })
  if (!discipline) return { error: "Disziplin nicht gefunden." }

  const parsed = DisciplineSchema.safeParse({
    name: formData.get("name"),
    scoringType: formData.get("scoringType"),
  })
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  if (parsed.data.scoringType !== discipline.scoringType) {
    // Wertungsartwechsel verhindert inkonsistente historische Ergebnisse
    const leagueCount = await db.league.count({ where: { disciplineId: id } })
    if (leagueCount > 0) {
      return {
        error:
          "Wertungsart kann nicht geändert werden — die Disziplin wird bereits in Ligen verwendet.",
      }
    }
  }

  await db.discipline.update({ where: { id }, data: parsed.data })
  revalidateDisciplinePaths()
  return { success: true }
}

export async function setDisciplineArchived(id: string, archive: boolean): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet" }
  if (session.user.role !== "ADMIN") return { error: "Keine Berechtigung" }

  const discipline = await db.discipline.findUnique({
    where: { id },
    select: { id: true, isArchived: true },
  })
  if (!discipline) return { error: "Disziplin nicht gefunden." }
  if (discipline.isArchived === archive) return { success: true }

  await db.discipline.update({ where: { id }, data: { isArchived: archive } })
  revalidateDisciplinePaths()
  return { success: true }
}

export async function deleteDiscipline(id: string): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet" }
  if (session.user.role !== "ADMIN") return { error: "Keine Berechtigung" }

  const discipline = await db.discipline.findUnique({
    where: { id },
    select: { id: true },
  })
  if (!discipline) return { error: "Disziplin nicht gefunden." }

  // Endgültiges Löschen nur ohne Ligaverwendung, damit keine FK-Verweise brechen
  const leagueCount = await db.league.count({ where: { disciplineId: id } })
  if (leagueCount > 0) {
    return { error: "Disziplin kann nicht gelöscht werden — sie wird in Ligen verwendet." }
  }

  await db.discipline.delete({ where: { id } })
  revalidateDisciplinePaths()
  return { success: true }
}

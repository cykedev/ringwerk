import type { Discipline } from "@/generated/prisma/client"
import { db } from "@/lib/db"

/** Alle aktiven (nicht archivierten) Disziplinen — für Auswahlfelder. */
export async function getDisciplines(): Promise<Discipline[]> {
  return db.discipline.findMany({
    where: { isArchived: false },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
  })
}

/** Alle Disziplinen inkl. archivierter — für Admin-Verwaltungsansicht. */
export async function getDisciplinesForManagement(): Promise<Discipline[]> {
  return db.discipline.findMany({
    orderBy: [{ isSystem: "desc" }, { isArchived: "asc" }, { name: "asc" }],
  })
}

export async function getDisciplineById(id: string): Promise<Discipline | null> {
  return db.discipline.findUnique({ where: { id } })
}

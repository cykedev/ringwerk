import type { PrismaClient, ScoringType } from "@/generated/prisma/client"

interface SystemDiscipline {
  name: string
  scoringType: ScoringType
}

// Vorinstallierte Standarddisziplinen gemäss features.md
const SYSTEM_DISCIPLINES: SystemDiscipline[] = [
  { name: "Luftpistole", scoringType: "WHOLE" },
  { name: "Luftgewehr", scoringType: "WHOLE" },
  { name: "Luftpistole Auflage", scoringType: "DECIMAL" },
  { name: "Luftgewehr Auflage", scoringType: "DECIMAL" },
]

function buildSystemDisciplineId(name: string): string {
  // Deterministische IDs verhindern doppeltes Anlegen bei Wiederholung von runStartup()
  return `system-${name.toLowerCase().replace(/\s+/g, "-")}`
}

/**
 * Legt fehlende Systemdisziplinen an. Idempotent — bereits vorhandene werden übersprungen.
 * Wird von runStartup() beim ersten App-Start aufgerufen.
 */
export async function ensureSystemDisciplines(prisma: PrismaClient): Promise<number> {
  let createdCount = 0

  for (const discipline of SYSTEM_DISCIPLINES) {
    const id = buildSystemDisciplineId(discipline.name)

    const existing = await prisma.discipline.findUnique({
      where: { id },
      select: { id: true },
    })

    if (existing) continue

    await prisma.discipline.create({
      data: { id, ...discipline, isSystem: true },
    })

    createdCount++
  }

  return createdCount
}

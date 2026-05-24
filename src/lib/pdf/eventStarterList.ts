export interface StarterListInputParticipant {
  status: "ACTIVE" | "WITHDRAWN"
  participant: { firstName: string; lastName: string }
  discipline: { name: string } | null
}

export interface StarterListRow {
  nr: number
  firstName: string
  lastName: string
  disciplineName: string | null
}

interface BuildArgs {
  participants: StarterListInputParticipant[]
  competitionDisciplineName: string | null
  random: () => number
}

/**
 * Filters ACTIVE participants, resolves discipline (per-row → competition fallback),
 * and assigns a Fisher–Yates–shuffled start number 1..n.
 *
 * `random` injection makes the shuffle deterministic in tests.
 */
export function buildStarterListRows({
  participants,
  competitionDisciplineName,
  random,
}: BuildArgs): StarterListRow[] {
  const active = participants.filter((p) => p.status === "ACTIVE")
  const shuffled = [...active]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled.map((cp, idx) => ({
    nr: idx + 1,
    firstName: cp.participant.firstName,
    lastName: cp.participant.lastName,
    disciplineName: cp.discipline?.name ?? competitionDisciplineName ?? null,
  }))
}

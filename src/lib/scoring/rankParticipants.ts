import type { ScoringMode } from "@/generated/prisma/client"
import type { RankableEntry, RankedEntry } from "./types"
import { SCORE_DIRECTION } from "./types"

/**
 * Sortiert eine Liste von Einträgen nach dem Score des gegebenen Wertungsmodus
 * und weist jedem Eintrag einen Rang zu (1-basiert).
 *
 * TARGET_UNDER: Einträge mit Messwert ≤ Zielwert (Score < 1e9) werden durch
 * die Score-Kodierung automatisch vor Über-Zielwert-Einträgen platziert.
 *
 * Die Originalliste wird nicht verändert.
 */
export function rankByScore(entries: RankableEntry[], mode: ScoringMode): RankedEntry[] {
  const direction = SCORE_DIRECTION[mode]
  const sorted = [...entries].sort((a, b) =>
    direction === "asc" ? a.score - b.score : b.score - a.score
  )
  return sorted.map((entry, index) => ({ ...entry, rank: index + 1 }))
}

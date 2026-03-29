import type { ScoringMode } from "@/generated/prisma/client"

export const SCORING_MODE_LABELS: Record<ScoringMode, string> = {
  RINGTEILER: "Ringteiler",
  RINGS: "Ringe",
  RINGS_DECIMAL: "Ringe (Zehntel)",
  TEILER: "Teiler",
  DECIMAL_REST: "Dezimalrest",
  TARGET_ABSOLUTE: "Zielwert absolut",
  TARGET_UNDER: "Zielwert unter",
  TARGET_OVER: "Zielwert über",
}

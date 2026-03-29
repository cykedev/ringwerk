import { revalidatePath } from "next/cache"
import { z } from "zod"
import { ScoringMode, TeamScoring, TargetValueType } from "@/generated/prisma/client"

const PLAYOFF_SCORING_MODES = ["RINGTEILER", "RINGS", "RINGS_DECIMAL", "TEILER"] as const

export function parseDate(value: string | null | undefined): Date | null {
  if (!value || value.trim() === "") return null
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : d
}

export function revalidateCompetitionPaths(): void {
  revalidatePath("/competitions")
  revalidatePath("/competitions", "layout")
}

export const BaseSchema = z
  .object({
    name: z.string().min(1, "Name ist erforderlich").max(100, "Name zu lang"),
    scoringMode: z.nativeEnum(ScoringMode, {
      message: "Ungültiger Wertungsmodus",
    }),
    shotsPerSeries: z
      .string()
      .nullable()
      .optional()
      .transform((v) => (v ? parseInt(v, 10) : 10))
      .pipe(z.number().min(1).max(100)),
    disciplineId: z
      .string()
      .nullable()
      .optional()
      .transform((v) => (v && v !== "mixed" ? v : null)),
    // Liga
    hinrundeDeadline: z.string().nullable().optional(),
    rueckrundeDeadline: z.string().nullable().optional(),
    // Event
    eventDate: z.string().nullable().optional(),
    allowGuests: z
      .string()
      .nullable()
      .optional()
      .transform((v) => v === "true" || v === "on"),
    teamSize: z
      .string()
      .nullable()
      .optional()
      .transform((v) => (v && v.trim() !== "" ? parseInt(v, 10) : null)),
    teamScoring: z
      .nativeEnum(TeamScoring)
      .nullable()
      .optional()
      .transform((v) => v || null),
    targetValue: z
      .string()
      .nullable()
      .optional()
      .transform((v) => (v && v.trim() !== "" ? parseFloat(v.replace(",", ".")) : null)),
    targetValueType: z
      .nativeEnum(TargetValueType)
      .nullable()
      .optional()
      .transform((v) => v || null),
    // Saison
    minSeries: z
      .string()
      .nullable()
      .optional()
      .transform((v) => (v && v.trim() !== "" ? parseInt(v, 10) : null)),
    seasonStart: z.string().nullable().optional(),
    seasonEnd: z.string().nullable().optional(),
    // Liga – Regelset
    playoffBestOf: z
      .string()
      .nullable()
      .optional()
      .transform((v) => (v && v.trim() !== "" ? parseInt(v, 10) : null)),
    playoffHasViertelfinale: z
      .string()
      .nullable()
      .optional()
      .transform((v) => v === "true" || v === "on"),
    playoffHasAchtelfinale: z
      .string()
      .nullable()
      .optional()
      .transform((v) => v === "true" || v === "on"),
    finalePrimary: z.preprocess(
      (v) => (!v || v === "" ? "RINGS" : v),
      z.enum(PLAYOFF_SCORING_MODES)
    ),
    finaleTiebreaker1: z.preprocess(
      (v) => (v === "none" || v === "" || !v ? null : v),
      z.enum(PLAYOFF_SCORING_MODES).nullable()
    ),
    finaleTiebreaker2: z.preprocess(
      (v) => (v === "none" || v === "" || !v ? null : v),
      z.enum(PLAYOFF_SCORING_MODES).nullable()
    ),
    finaleHasSuddenDeath: z
      .string()
      .nullable()
      .optional()
      .transform((v) => v === "true" || v === "on"),
  })
  .superRefine((data, ctx) => {
    if (data.finaleTiebreaker2 && !data.finaleTiebreaker1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Tiebreaker 2 setzt Tiebreaker 1 voraus",
        path: ["finaleTiebreaker2"],
      })
    }
  })

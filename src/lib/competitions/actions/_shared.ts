import { revalidatePath, revalidateTag } from "next/cache"
import { z } from "zod"
import { ScoringMode, TeamScoring, TargetValueType } from "@/generated/prisma/client"
import { SLUG_REGEX } from "../publicSlug"

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

export function publicPdfCacheTag(slug: string): string {
  return `public-pdf:${slug}`
}

export function revalidatePublicSlug(slug: string | null | undefined): void {
  if (!slug) return
  // "max" profile: evict all cached entries with this tag immediately
  revalidateTag(publicPdfCacheTag(slug), "max")
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
    isPublic: z
      .string()
      .nullable()
      .optional()
      .transform((v) => v === "true" || v === "on"),
    publicSlug: z
      .string()
      .nullable()
      .optional()
      .transform((v) => (v == null || v.trim() === "" ? null : v.trim())),
    // Plaintext password — never persisted as-is. Empty string / null = "leave existing hash alone"
    publicPassword: z
      .string()
      .nullable()
      .optional()
      .transform((v) => (v == null || v === "" ? null : v)),
    // "Passwort entfernen" checkbox — if true, clear the hash regardless of publicPassword
    removePublicPassword: z
      .string()
      .nullable()
      .optional()
      .transform((v) => v === "true" || v === "on"),
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
    if (data.isPublic) {
      if (!data.publicSlug) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Slug ist erforderlich, wenn 'Auf Vereins-Website veröffentlichen' aktiv ist",
          path: ["publicSlug"],
        })
      } else if (!SLUG_REGEX.test(data.publicSlug)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Slug: 3–60 Zeichen, nur a–z, 0–9 und Bindestriche, keine doppelten Bindestriche",
          path: ["publicSlug"],
        })
      }
    }
    if (
      data.publicPassword !== null &&
      data.publicPassword !== undefined &&
      data.publicPassword.length < 4
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Passwort muss mindestens 4 Zeichen haben",
        path: ["publicPassword"],
      })
    }
  })

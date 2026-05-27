import type { Competition } from "@/generated/prisma/client"
import { db } from "@/lib/db"

/** Valid public slug: lowercase alphanumeric + single dashes, 3–60 chars, no leading/trailing dash, no double-dash. */
export const SLUG_REGEX = /^(?=.{3,60}$)[a-z0-9]+(-[a-z0-9]+)*$/

const UMLAUT_MAP: Record<string, string> = {
  ä: "ae",
  ö: "oe",
  ü: "ue",
  ß: "ss",
  Ä: "ae",
  Ö: "oe",
  Ü: "ue",
}

/**
 * Convert a competition name into a URL-safe slug.
 * - Lowercase
 * - German umlauts transliterated (ä→ae, ö→oe, ü→ue, ß→ss)
 * - Everything except [a-z0-9] becomes a dash
 * - Collapse multiple dashes, trim from both ends
 * Returns empty string if nothing valid remains. Length is NOT clamped — callers must check SLUG_REGEX
 * (which enforces 3–60 chars when used with .test()) before storing.
 */
export function slugify(name: string): string {
  const transliterated = name.replace(/[äöüßÄÖÜ]/g, (c) => UMLAUT_MAP[c] ?? c)
  const lowered = transliterated.toLowerCase()
  const dashed = lowered.replace(/[^a-z0-9]+/g, "-")
  return dashed.replace(/^-+|-+$/g, "")
}

/**
 * Resolve a public slug to a Competition.
 * 1. Prefer the ACTIVE+isPublic claimant if any.
 * 2. Otherwise fall back to the most recently created (createdAt DESC) COMPLETED/ARCHIVED+isPublic holder.
 * 3. Return null if no isPublic competition has this slug.
 */
export async function resolveSlug(slug: string): Promise<Competition | null> {
  const active = await db.competition.findFirst({
    where: { publicSlug: slug, isPublic: true, status: "ACTIVE" },
  })
  if (active) return active

  return db.competition.findFirst({
    where: {
      publicSlug: slug,
      isPublic: true,
      status: { in: ["COMPLETED", "ARCHIVED"] },
    },
    orderBy: { createdAt: "desc" },
  })
}

/**
 * Check whether another ACTIVE+isPublic competition already holds this slug.
 * `excludeId` is the competition currently being edited (excluded from the check).
 * Returns { id, name } of the conflicting competition, or null if none.
 */
export async function findActiveSlugConflict(
  slug: string,
  excludeId: string | null
): Promise<{ id: string; name: string } | null> {
  const conflict = await db.competition.findFirst({
    where: {
      publicSlug: slug,
      isPublic: true,
      status: "ACTIVE",
      ...(excludeId != null ? { id: { not: excludeId } } : {}),
    },
    select: { id: true, name: true },
  })
  return conflict
}

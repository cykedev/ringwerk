# Public Competition PDFs — Design

**Date:** 2026-05-26
**Status:** Draft

## Goal

Expose the main result PDF of selected competitions via a stable, unauthenticated URL so the club's public website can link to "current standings" without coordinating per-year link updates. The exposed URL is phase-agnostic — it serves whichever PDF best reflects the current state of the competition.

## Scope

**In scope:**

- New `isPublic` toggle and `publicSlug` field on `Competition`
- One public route per slug that returns a PDF (live-rendered, cached 24h)
- Edit-form UI to toggle public visibility and edit the slug
- Cache invalidation hooks on status transitions and slug edits

**Out of scope:**

- Public HTML pages, JSON API, embeddable widgets — only PDF
- Multiple PDFs per competition (only the "main" PDF per type)
- URL redirects after slug change — old URL just 404s
- Audit-log entries for publishing/unpublishing (read-only side effect)
- Rate limiting or hotlink protection — on-prem deployment, low expected traffic

## User Story

As an admin maintaining the club website, I want a stable PDF link per competition (e.g. `…/api/public/c/jahrespreisschiessen/pdf`) that I can paste once on the website and that always reflects the current state of the competition. When the Liga moves to Playoffs, the same URL should automatically serve the Playoff bracket instead of the schedule. When next year's Jahrespreisschiessen starts, the same URL should switch to point at the new competition without any change on the website.

## URL Shape

```
GET /api/public/c/<slug>/pdf
```

- Lives outside `proxy.ts`'s auth matcher (verified: matcher covers `/`, `/competitions`, `/participants`, `/disciplines`, `/admin`, `/account` — none cover `/api/*`)
- One URL per competition — server picks the right PDF based on competition type and phase
- Slug is lowercase, dash-separated, 3–60 chars, regex `^[a-z0-9](-?[a-z0-9])+$`
- The `/pdf` path segment mirrors the existing pattern `/api/competitions/[id]/pdf/<type>` and is preferred over a `.pdf` suffix for consistency. The PDF filename in `Content-Disposition` is `<slug>.pdf`, so saved files still get a `.pdf` extension.

## PDF Selection Logic

For the competition resolved by the slug lookup (see next section), the route serves:

| Competition type | Condition                       | PDF                             |
| ---------------- | ------------------------------- | ------------------------------- |
| EVENT            | always                          | `EventRankingPdf`               |
| SEASON           | always                          | `SeasonStandingsPdf`            |
| LEAGUE           | no `PlayoffMatch` rows exist    | `SchedulePdf` (Spielplan+Tab.)  |
| LEAGUE           | one or more `PlayoffMatch` rows | `PlayoffsPdf` (Bracket)         |

The "playoff phase active" check reuses whatever query/flag the existing Liga implementation already uses to detect Playoff start — discovered during plan writing, not specified here.

## Slug Resolution

Goal: a single slug can be carried forward across years of similar competitions without dead links.

**Active-claim rule:** A slug is "claimed" by a competition when `isPublic = true AND status = ACTIVE`. Only one such competition may exist per slug at any time. Other statuses (DRAFT, COMPLETED, ARCHIVED) do not claim a slug — they remain attached to it but can be displaced.

**Resolution at request time:**

1. Look up `Competition` where `publicSlug = <slug> AND isPublic = true AND status = ACTIVE` → if found, serve this one (live state)
2. Otherwise, look up the most recent (`ORDER BY createdAt DESC`) `Competition` where `publicSlug = <slug> AND isPublic = true AND status IN (COMPLETED, ARCHIVED)` → if found, serve this one (historical fallback)
3. Otherwise → HTTP 404

**Database constraint:** A partial unique index enforces the active-claim rule at the DB level:

```sql
CREATE UNIQUE INDEX competition_public_slug_active_unique
ON "Competition" ("publicSlug")
WHERE "isPublic" = true AND status = 'ACTIVE';
```

This is added as raw SQL inside the Prisma migration (Prisma cannot express partial unique indexes directly).

**Action-layer validation:** Server actions that can create an active claim (`updateCompetition`, `updateCompetitionStatus` transitioning to ACTIVE) re-run the conflict check before saving, so users get a clear error message instead of a database constraint failure:

> "Slug ist bereits vom aktiven Wettbewerb '<Name>' belegt. Wählen Sie einen anderen Slug oder schließen Sie den anderen Wettbewerb zuerst ab."

## Slug Lifecycle

- **First publish:** Toggling `isPublic = true` for the first time pre-fills the slug field from the competition name (slugify: lowercase, ASCII transliteration of umlauts ä→ae etc., dashes for spaces, strip everything else). The admin sees the proposed slug and can edit it before saving.
- **Editable after publish:** The slug can be changed at any later point (subject to the active-claim conflict check). Old URLs become 404 — accepted trade-off; documented in the edit UI as a warning.
- **Unpublish:** Setting `isPublic = false` leaves the slug stored on the competition but releases the active claim. Re-enabling publishing later restores the same URL (assuming no other ACTIVE competition has taken the slug in the meantime, in which case the action returns a conflict error).
- **Archive/Complete:** No effect on the stored slug. The competition simply stops being the "ACTIVE claimant" and becomes eligible for the fallback path.

## Schema Changes

```prisma
model Competition {
  // … existing fields …
  isPublic    Boolean @default(false)
  publicSlug  String?

  // No @unique on publicSlug — see partial index in migration
}
```

The partial unique index is added as raw SQL in the migration body.

## UI Changes

### Edit form (`/competitions/[id]/edit`)

A new section after the existing "Allgemein" fields:

- **Switch** "Auf Vereins-Website veröffentlichen" — bound to `isPublic`
- When switch is on, a **slug input** appears:
  - Pre-filled from name on first toggle, retained from previous publish otherwise
  - Inline validation (regex, length)
  - Live URL preview below the field: `…/api/public/c/<slug>.pdf`
  - Helper text when slug differs from stored value: "Hinweis: Die bestehende öffentliche URL wird ungültig."
  - Helper text when the slug is currently held by another ACTIVE competition (server-side check on submit): the error message from the action

The switch and slug field follow existing form patterns in the file — no new component library work.

### New competition form (`/competitions/new`)

Same fields as the edit form, off by default. Most new competitions will start as DRAFT, so the active-claim conflict is rare at create time — but the check still runs if the user creates a competition directly as ACTIVE with `isPublic = true`.

### Public marker in lists

A small badge "Öffentlich" next to the competition name on the competitions list page when `isPublic = true`, so admins can tell at a glance which competitions are exposed. No badge on archived competitions (since they no longer hold the active claim — showing the badge would be misleading).

## Caching & Invalidation

### Caching strategy

The public route uses Next.js route-level revalidation:

```ts
// src/app/api/public/c/[slug]/pdf/route.ts
export const revalidate = 86400 // 24 hours
```

This means the PDF is regenerated lazily on the first request after 24h, with results cached in between. No cron job, no disk persistence. First-request latency after cache expiry is ~1–2 seconds (PDF render); acceptable for the expected traffic profile.

### Manual invalidation

`revalidatePath('/api/public/c/<slug>/pdf')` is called from any server action that can change which PDF should be served under a slug:

| Action                                 | When                                                     |
| -------------------------------------- | -------------------------------------------------------- |
| `updateCompetition`                    | After save, if `isPublic`, slug or name changed          |
| `updateCompetitionStatus`              | After save, if competition has `isPublic = true`         |
| `startPlayoffs`                        | After Playoffs start (Liga URL must switch PDF)          |
| `forceDeleteCompetition`               | After delete, if the deleted competition had a slug      |

For actions like `enterResult`, `addEventSeries`, `addSeasonSeries` — these can change the contents of the PDF but not which competition the slug points at. We accept up to 24h staleness here; otherwise we'd be invalidating on every result entry, defeating the cache. This trade-off is consistent with the "täglich aktualisiert reicht" requirement.

For affected slugs, both the *previously* and the *newly* responsible slug paths are revalidated when applicable (e.g. on slug edit, both old and new path get revalidated).

## Auth and Security

- `proxy.ts` matcher does **not** match `/api/public/*` — verify during implementation that the existing matcher list excludes this prefix
- Route is unauthenticated by design
- Server-side check inside the route: 404 if no competition resolves; never expose details about *why* a slug 404s
- Slug regex prevents path traversal or weird characters; Prisma parameter binding prevents injection
- Response headers:
  - `Content-Type: application/pdf`
  - `Content-Disposition: inline; filename="<slug>.pdf"`
  - `Cache-Control: public, max-age=86400, s-maxage=86400` (matches `revalidate`)

## Components Touched / Added

| Path                                                                  | Change          |
| --------------------------------------------------------------------- | --------------- |
| `prisma/schema.prisma`                                                | + `isPublic`, `publicSlug` |
| `prisma/migrations/<timestamp>_add_competition_public_slug/…`         | new migration with partial unique index |
| `src/app/api/public/c/[slug]/pdf/route.ts`                            | new route handler |
| `src/lib/competitions/publicSlug.ts`                                  | new: `slugify(name)`, `resolveSlug(slug)`, conflict check |
| `src/lib/competitions/publicSlug.test.ts`                             | new: slug generation + resolution test cases |
| `src/lib/competitions/actions.ts`                                     | extend update/status actions with slug validation + `revalidatePath` |
| `src/lib/competitions/types.ts`                                       | include `isPublic`, `publicSlug` in returned shapes |
| `src/lib/competitions/queries.ts`                                     | include new fields in selects |
| `src/components/app/competitions/CompetitionForm.tsx`                 | add publish switch + slug input |
| `src/app/(app)/competitions/page.tsx`                                 | "Öffentlich" badge on the competition card/row |
| `.claude/docs/features.md`                                            | document the public PDF feature |
| `.claude/docs/architecture.md`                                        | add `/api/public/c/[slug]/pdf` route to the routes list |

## Test Plan

**Unit tests (`publicSlug.test.ts`):**

- `slugify("Jahrespreisschiessen 2026")` → `"jahrespreisschiessen-2026"`
- `slugify("Schützenmeister-Pokal")` → `"schuetzenmeister-pokal"`
- Slug regex rejects empty, too short, leading/trailing dashes, non-ASCII
- `resolveSlug` returns ACTIVE claimant when present
- `resolveSlug` returns most-recent COMPLETED/ARCHIVED fallback when no ACTIVE claimant
- `resolveSlug` returns null when no match
- `resolveSlug` ignores `isPublic = false` rows even with matching slug

**Action tests (`actions.test.ts` additions):**

- Setting `isPublic = true` on a new competition succeeds; slug is stored
- Conflicting slug on a second ACTIVE+isPublic competition returns the German error message; nothing is saved
- Setting `isPublic = false` releases the slug for reuse by another competition
- Status transition COMPLETED → ACTIVE while another ACTIVE+isPublic holds the slug returns the same error

**Route handler tests** (if existing PDF routes have integration tests; otherwise rely on manual verification):

- 404 when slug does not exist
- 404 when slug exists but `isPublic = false`
- 200 + correct PDF when ACTIVE claimant exists
- 200 + correct PDF when only archived holder exists
- LEAGUE without playoffs → SchedulePdf
- LEAGUE with playoffs → PlayoffsPdf

**Manual verification:**

- Create a Jahrespreisschiessen 2026 SEASON, mark public, copy URL, open anonymously → PDF loads
- Archive it, create Jahrespreisschiessen 2027 with same slug → same URL now shows 2027
- Archive 2027 too → URL shows 2027 (most recent fallback)
- Start a Liga, publish, check URL → Spielplan PDF
- Start Playoffs → URL switches to Playoffs PDF (after cache invalidation)

## Open Questions / Decisions

None remaining — design closed pending plan-writing.

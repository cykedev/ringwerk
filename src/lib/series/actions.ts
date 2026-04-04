"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { db } from "@/lib/db"
import { getAuthSession, canManage } from "@/lib/auth-helpers"
import type { ActionResult } from "@/lib/types"
import { calculateRingteiler } from "@/lib/results/calculateResult"
import { getEffectiveScoringType, getMaxRings } from "@/lib/series/scoring-format"

const SeriesSchema = z.object({
  rings: z
    .string()
    .min(1, "Ringe sind erforderlich")
    .transform((v) => parseFloat(v.replace(",", ".")))
    .pipe(z.number().min(0, "Ringe müssen ≥ 0 sein")),
  teiler: z
    .string()
    .min(1, "Teiler ist erforderlich")
    .transform((v) => parseFloat(v.replace(",", ".")))
    .pipe(z.number().min(0, "Teiler muss ≥ 0 sein").max(9999.9, "Teiler zu groß")),
})

function revalidateEventPaths(competitionId: string): void {
  revalidatePath(`/competitions/${competitionId}/series`)
  revalidatePath(`/competitions/${competitionId}/ranking`)
}

function revalidateSeasonPaths(competitionId: string): void {
  revalidatePath(`/competitions/${competitionId}/series`)
  revalidatePath(`/competitions/${competitionId}/standings`)
}

// ─────────────────────────────────────────────────────────────
// SAVE (Create or Update)
// ─────────────────────────────────────────────────────────────

/**
 * Speichert eine Serie für einen Event-Teilnehmer.
 * Pro Einschreibung (CompetitionParticipant) ist genau eine Serie erlaubt — bestehende wird überschrieben.
 */
export async function saveEventSeries(
  competitionId: string,
  competitionParticipantId: string,
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet." }
  if (!canManage(session.user.role)) return { error: "Keine Berechtigung." }

  const competition = await db.competition.findUnique({
    where: { id: competitionId },
    select: {
      id: true,
      type: true,
      status: true,
      shotsPerSeries: true,
      disciplineId: true,
      scoringMode: true,
    },
  })
  if (!competition) return { error: "Wettbewerb nicht gefunden." }
  if (competition.type !== "EVENT") return { error: "Nur für Event-Wettbewerbe." }
  if (competition.status === "ARCHIVED") return { error: "Archivierte Wettbewerbe sind gesperrt." }

  // Disziplin bestimmen: aus CompetitionParticipant (gemischt) oder Competition (fix)
  const cp = await db.competitionParticipant.findUnique({
    where: { id: competitionParticipantId },
    select: {
      id: true,
      participantId: true,
      disciplineId: true,
      discipline: { select: { id: true, name: true, scoringType: true, teilerFaktor: true } },
      participant: { select: { firstName: true, lastName: true } },
    },
  })
  if (!cp) return { error: "Teilnehmer nicht in diesem Wettbewerb eingeschrieben." }

  let disciplineId = cp.disciplineId
  let discipline = cp.discipline

  if (!disciplineId || !discipline) {
    // Feste Disziplin der Competition verwenden
    if (!competition.disciplineId) return { error: "Keine Disziplin konfiguriert." }
    const compDiscipline = await db.discipline.findUnique({
      where: { id: competition.disciplineId },
      select: { id: true, name: true, scoringType: true, teilerFaktor: true },
    })
    if (!compDiscipline) return { error: "Disziplin nicht gefunden." }
    disciplineId = compDiscipline.id
    discipline = compDiscipline
  }

  const parsed = SeriesSchema.safeParse({
    rings: formData.get("rings"),
    teiler: formData.get("teiler"),
  })
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const { rings, teiler } = parsed.data

  // Effektiver Scoring-Typ bestimmt Ringformat und Maximum
  const effectiveScoringType = getEffectiveScoringType(competition.scoringMode, discipline)
  const maxRings = getMaxRings(effectiveScoringType, competition.shotsPerSeries)
  if (rings > maxRings) {
    return {
      error: {
        rings: [
          `Maximal ${effectiveScoringType === "DECIMAL" ? maxRings.toFixed(1).replace(".", ",") : maxRings} Ringe erlaubt`,
        ],
      },
    }
  }
  if (effectiveScoringType === "WHOLE" && !Number.isInteger(rings)) {
    return { error: { rings: ["Nur ganze Ringe erlaubt"] } }
  }

  const teilerFaktor = discipline.teilerFaktor.toNumber()
  const ringteiler = calculateRingteiler(rings, teiler, teilerFaktor, maxRings)

  const sessionDate = new Date()

  // Bestehendes Ergebnis prüfen (eine Serie pro Einschreibung pro Event)
  const existing = await db.series.findUnique({
    where: { competitionParticipantId },
    select: { id: true },
  })

  if (existing) {
    await db.series.update({
      where: { id: existing.id },
      data: {
        rings,
        teiler,
        ringteiler,
        disciplineId,
        shotCount: competition.shotsPerSeries,
        sessionDate,
        recordedByUserId: session.user.id,
      },
    })
  } else {
    await db.series.create({
      data: {
        competitionId,
        participantId: cp.participantId,
        competitionParticipantId,
        disciplineId,
        rings,
        teiler,
        ringteiler,
        shotCount: competition.shotsPerSeries,
        sessionDate,
        recordedByUserId: session.user.id,
      },
    })
  }

  const participantName = `${cp.participant.firstName} ${cp.participant.lastName}`

  await db.auditLog.create({
    data: {
      eventType: existing ? "EVENT_SERIES_CORRECTED" : "EVENT_SERIES_ENTERED",
      entityType: "SERIES",
      entityId: existing?.id ?? competitionParticipantId,
      userId: session.user.id,
      competitionId,
      details: {
        participantName,
        rings,
        teiler,
        disciplineName: discipline.name,
      },
    },
  })

  revalidateEventPaths(competitionId)
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────────────────────

/** Löscht die Serie eines Event-Teilnehmers. */
export async function deleteEventSeries(
  seriesId: string,
  competitionId: string
): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet." }
  if (!canManage(session.user.role)) return { error: "Keine Berechtigung." }

  const series = await db.series.findUnique({
    where: { id: seriesId },
    select: {
      id: true,
      competitionId: true,
      rings: true,
      teiler: true,
      participant: { select: { firstName: true, lastName: true } },
    },
  })
  if (!series) return { error: "Serie nicht gefunden." }
  if (series.competitionId !== competitionId) return { error: "Ungültige Anfrage." }

  await db.series.delete({ where: { id: seriesId } })

  await db.auditLog.create({
    data: {
      eventType: "EVENT_SERIES_DELETED",
      entityType: "SERIES",
      entityId: seriesId,
      userId: session.user.id,
      competitionId,
      details: {
        participantName: `${series.participant.firstName} ${series.participant.lastName}`,
        rings: series.rings,
        teiler: series.teiler,
      },
    },
  })

  revalidateEventPaths(competitionId)
  return { success: true }
}

// ─────────────────────────────────────────────────────────────
// SAISON-SERIES
// ─────────────────────────────────────────────────────────────

const SeasonSeriesSchema = SeriesSchema.extend({
  sessionDate: z
    .string()
    .min(1, "Datum ist erforderlich")
    .transform((v) => new Date(v))
    .pipe(z.date({ message: "Ungültiges Datum" })),
  disciplineId: z
    .string()
    .nullable()
    .optional()
    .transform((v) => v || null),
})

/**
 * Erfasst eine neue Serie für einen Saison-Teilnehmer.
 * Mehrere Serien pro Teilnehmer erlaubt — immer create, nie upsert.
 */
export async function saveSeasonSeries(
  competitionId: string,
  participantId: string,
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet." }
  if (!canManage(session.user.role)) return { error: "Keine Berechtigung." }

  const competition = await db.competition.findUnique({
    where: { id: competitionId },
    select: {
      id: true,
      type: true,
      status: true,
      shotsPerSeries: true,
      disciplineId: true,
      scoringMode: true,
    },
  })
  if (!competition) return { error: "Wettbewerb nicht gefunden." }
  if (competition.type !== "SEASON") return { error: "Nur für Saison-Wettbewerbe." }
  if (competition.status === "ARCHIVED") return { error: "Archivierte Wettbewerbe sind gesperrt." }

  const cp = await db.competitionParticipant.findFirst({
    where: { competitionId, participantId },
    select: {
      id: true,
      disciplineId: true,
      discipline: { select: { id: true, name: true, scoringType: true, teilerFaktor: true } },
      participant: { select: { firstName: true, lastName: true } },
    },
  })
  if (!cp) return { error: "Teilnehmer nicht in diesem Wettbewerb eingeschrieben." }

  const parsed = SeasonSeriesSchema.safeParse({
    rings: formData.get("rings"),
    teiler: formData.get("teiler"),
    sessionDate: formData.get("sessionDate"),
    disciplineId: formData.get("disciplineId"),
  })
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  // Disziplin: aus formData (gemischt) → Teilnehmer-Disziplin → Competition-Disziplin
  const resolvedDisciplineId =
    parsed.data.disciplineId ?? cp.disciplineId ?? competition.disciplineId

  let discipline = cp.discipline
  if (!discipline || (parsed.data.disciplineId && parsed.data.disciplineId !== cp.disciplineId)) {
    if (!resolvedDisciplineId) return { error: "Keine Disziplin konfiguriert." }
    const found = await db.discipline.findUnique({
      where: { id: resolvedDisciplineId },
      select: { id: true, name: true, scoringType: true, teilerFaktor: true },
    })
    if (!found) return { error: "Disziplin nicht gefunden." }
    discipline = found
  }

  if (!resolvedDisciplineId || !discipline) return { error: "Keine Disziplin konfiguriert." }

  const { rings, teiler, sessionDate } = parsed.data

  // Effektiver Scoring-Typ bestimmt Ringformat und Maximum
  const effectiveScoringType = getEffectiveScoringType(competition.scoringMode, discipline)
  const maxRings = getMaxRings(effectiveScoringType, competition.shotsPerSeries)
  if (rings > maxRings) {
    return {
      error: {
        rings: [
          `Maximal ${effectiveScoringType === "DECIMAL" ? maxRings.toFixed(1).replace(".", ",") : maxRings} Ringe erlaubt`,
        ],
      },
    }
  }
  if (effectiveScoringType === "WHOLE" && !Number.isInteger(rings)) {
    return { error: { rings: ["Nur ganze Ringe erlaubt"] } }
  }

  const teilerFaktor = discipline.teilerFaktor.toNumber()
  const ringteiler = calculateRingteiler(rings, teiler, teilerFaktor, maxRings)

  await db.series.create({
    data: {
      competitionId,
      participantId,
      disciplineId: resolvedDisciplineId,
      rings,
      teiler,
      ringteiler,
      shotCount: competition.shotsPerSeries,
      sessionDate,
      recordedByUserId: session.user.id,
    },
  })

  await db.auditLog.create({
    data: {
      eventType: "SEASON_SERIES_ENTERED",
      entityType: "SERIES",
      entityId: participantId,
      userId: session.user.id,
      competitionId,
      details: {
        participantName: `${cp.participant.firstName} ${cp.participant.lastName}`,
        sessionDate: sessionDate.toISOString().slice(0, 10),
        rings,
        teiler,
        disciplineName: discipline.name,
      },
    },
  })

  revalidateSeasonPaths(competitionId)
  return { success: true }
}

/**
 * Korrigiert eine bestehende Saison-Serie (Update).
 * Identifiziert die Serie über seriesId; validiert Zugehörigkeit zum Wettbewerb.
 */
export async function updateSeasonSeries(
  competitionId: string,
  seriesId: string,
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet." }
  if (!canManage(session.user.role)) return { error: "Keine Berechtigung." }

  const competition = await db.competition.findUnique({
    where: { id: competitionId },
    select: {
      id: true,
      type: true,
      status: true,
      shotsPerSeries: true,
      disciplineId: true,
      scoringMode: true,
    },
  })
  if (!competition) return { error: "Wettbewerb nicht gefunden." }
  if (competition.type !== "SEASON") return { error: "Nur für Saison-Wettbewerbe." }
  if (competition.status === "ARCHIVED") return { error: "Archivierte Wettbewerbe sind gesperrt." }

  const existingSeries = await db.series.findUnique({
    where: { id: seriesId },
    select: {
      id: true,
      competitionId: true,
      participantId: true,
      participant: { select: { firstName: true, lastName: true } },
    },
  })
  if (!existingSeries) return { error: "Serie nicht gefunden." }
  if (existingSeries.competitionId !== competitionId) return { error: "Ungültige Anfrage." }

  const cp = await db.competitionParticipant.findFirst({
    where: {
      competitionId,
      participantId: existingSeries.participantId,
    },
    select: {
      disciplineId: true,
      discipline: { select: { id: true, name: true, scoringType: true, teilerFaktor: true } },
    },
  })
  if (!cp) return { error: "Teilnehmer nicht in diesem Wettbewerb eingeschrieben." }

  const parsed = SeasonSeriesSchema.safeParse({
    rings: formData.get("rings"),
    teiler: formData.get("teiler"),
    sessionDate: formData.get("sessionDate"),
    disciplineId: formData.get("disciplineId"),
  })
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const resolvedDisciplineId =
    parsed.data.disciplineId ?? cp.disciplineId ?? competition.disciplineId

  let discipline = cp.discipline
  if (!discipline || (parsed.data.disciplineId && parsed.data.disciplineId !== cp.disciplineId)) {
    if (!resolvedDisciplineId) return { error: "Keine Disziplin konfiguriert." }
    const found = await db.discipline.findUnique({
      where: { id: resolvedDisciplineId },
      select: { id: true, name: true, scoringType: true, teilerFaktor: true },
    })
    if (!found) return { error: "Disziplin nicht gefunden." }
    discipline = found
  }

  if (!resolvedDisciplineId || !discipline) return { error: "Keine Disziplin konfiguriert." }

  const { rings, teiler, sessionDate } = parsed.data

  // Effektiver Scoring-Typ bestimmt Ringformat und Maximum
  const effectiveScoringType = getEffectiveScoringType(competition.scoringMode, discipline)
  const maxRings = getMaxRings(effectiveScoringType, competition.shotsPerSeries)
  if (rings > maxRings) {
    return {
      error: {
        rings: [
          `Maximal ${effectiveScoringType === "DECIMAL" ? maxRings.toFixed(1).replace(".", ",") : maxRings} Ringe erlaubt`,
        ],
      },
    }
  }
  if (effectiveScoringType === "WHOLE" && !Number.isInteger(rings)) {
    return { error: { rings: ["Nur ganze Ringe erlaubt"] } }
  }

  const teilerFaktor = discipline.teilerFaktor.toNumber()
  const ringteiler = calculateRingteiler(rings, teiler, teilerFaktor, maxRings)

  await db.series.update({
    where: { id: seriesId },
    data: {
      rings,
      teiler,
      ringteiler,
      disciplineId: resolvedDisciplineId,
      shotCount: competition.shotsPerSeries,
      sessionDate,
      recordedByUserId: session.user.id,
    },
  })

  const participantName = `${existingSeries.participant.firstName} ${existingSeries.participant.lastName}`

  await db.auditLog.create({
    data: {
      eventType: "SEASON_SERIES_CORRECTED",
      entityType: "SERIES",
      entityId: seriesId,
      userId: session.user.id,
      competitionId,
      details: {
        participantName,
        sessionDate: sessionDate.toISOString().slice(0, 10),
        rings,
        teiler,
        disciplineName: discipline.name,
      },
    },
  })

  revalidateSeasonPaths(competitionId)
  return { success: true }
}

/** Löscht eine einzelne Saison-Serie. */
export async function deleteSeasonSeries(
  seriesId: string,
  competitionId: string
): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet." }
  if (!canManage(session.user.role)) return { error: "Keine Berechtigung." }

  const series = await db.series.findUnique({
    where: { id: seriesId },
    select: {
      id: true,
      competitionId: true,
      rings: true,
      teiler: true,
      sessionDate: true,
      participant: { select: { firstName: true, lastName: true } },
    },
  })
  if (!series) return { error: "Serie nicht gefunden." }
  if (series.competitionId !== competitionId) return { error: "Ungültige Anfrage." }

  await db.series.delete({ where: { id: seriesId } })

  await db.auditLog.create({
    data: {
      eventType: "SEASON_SERIES_DELETED",
      entityType: "SERIES",
      entityId: seriesId,
      userId: session.user.id,
      competitionId,
      details: {
        participantName: `${series.participant.firstName} ${series.participant.lastName}`,
        sessionDate: series.sessionDate.toISOString().slice(0, 10),
        rings: series.rings,
        teiler: series.teiler,
      },
    },
  })

  revalidateSeasonPaths(competitionId)
  return { success: true }
}

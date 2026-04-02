import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  getAuthSessionMock,
  revalidatePathMock,
  competitionFindUniqueMock,
  competitionDeleteMock,
  disciplineFindUniqueMock,
  competitionCreateMock,
  competitionUpdateMock,
  competitionParticipantCountMock,
  matchupCountMock,
  playoffMatchCountMock,
  transactionMock,
  auditLogCreateMock,
} = vi.hoisted(() => ({
  getAuthSessionMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  competitionFindUniqueMock: vi.fn(),
  competitionDeleteMock: vi.fn(),
  disciplineFindUniqueMock: vi.fn(),
  competitionCreateMock: vi.fn(),
  competitionUpdateMock: vi.fn(),
  competitionParticipantCountMock: vi.fn(),
  matchupCountMock: vi.fn(),
  playoffMatchCountMock: vi.fn(),
  transactionMock: vi.fn(),
  auditLogCreateMock: vi.fn(),
}))

vi.mock("@/lib/auth-helpers", () => ({
  getAuthSession: getAuthSessionMock,
  canManage: (role: string) => role === "ADMIN" || role === "MANAGER",
  isAdmin: (role: string) => role === "ADMIN",
}))
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }))
vi.mock("@/lib/db", () => ({
  db: {
    competition: {
      findUnique: competitionFindUniqueMock,
      create: competitionCreateMock,
      update: competitionUpdateMock,
      delete: competitionDeleteMock,
    },
    discipline: {
      findUnique: disciplineFindUniqueMock,
    },
    competitionParticipant: { count: competitionParticipantCountMock },
    matchup: { count: matchupCountMock },
    playoffMatch: { count: playoffMatchCountMock },
    auditLog: { create: auditLogCreateMock },
    $transaction: transactionMock,
  },
}))

import {
  createCompetition,
  updateCompetition,
  setCompetitionStatus,
  deleteCompetition,
  forceDeleteCompetition,
} from "@/lib/competitions/actions"

const adminSession = { user: { id: "u1", role: "ADMIN" } }
const userSession = { user: { id: "u2", role: "USER" } }
const managerSession = { user: { id: "u3", role: "MANAGER" } }

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

// ─── createCompetition ────────────────────────────────────────────────────────

describe("createCompetition", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    competitionCreateMock.mockResolvedValue({})
    disciplineFindUniqueMock.mockResolvedValue({ id: "d1" })
  })

  it("liefert Fehler ohne Session", async () => {
    getAuthSessionMock.mockResolvedValue(null)
    const result = await createCompetition(
      null,
      makeFormData({ name: "Liga A", disciplineId: "d1" })
    )
    expect(result).toEqual({ error: "Nicht angemeldet" })
    expect(competitionCreateMock).not.toHaveBeenCalled()
  })

  it("liefert Fehler wenn kein Admin", async () => {
    getAuthSessionMock.mockResolvedValue(userSession)
    const result = await createCompetition(
      null,
      makeFormData({ name: "Liga A", disciplineId: "d1" })
    )
    expect(result).toEqual({ error: "Keine Berechtigung" })
    expect(competitionCreateMock).not.toHaveBeenCalled()
  })

  it("erlaubt MANAGER das Erstellen", async () => {
    getAuthSessionMock.mockResolvedValue(managerSession)
    disciplineFindUniqueMock.mockResolvedValue({ id: "d1", scoringType: "WHOLE" })
    competitionCreateMock.mockResolvedValue({ id: "new1" })
    auditLogCreateMock.mockResolvedValue({})
    const fd = makeFormData({
      name: "Testwettbewerb",
      type: "EVENT",
      scoringMode: "RINGS",
      shotsPerSeries: "10",
      disciplineId: "d1",
    })
    const result = await createCompetition(null, fd)
    expect(result).toMatchObject({ success: true })
  })

  it("liefert Validierungsfehler bei leerem Namen", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const result = await createCompetition(null, makeFormData({ name: "", disciplineId: "d1" }))
    expect(result).toMatchObject({ error: { name: expect.any(Array) } })
    expect(competitionCreateMock).not.toHaveBeenCalled()
  })

  it("liefert Validierungsfehler bei fehlendem Wertungsmodus", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const result = await createCompetition(null, makeFormData({ name: "Liga A", type: "LEAGUE" }))
    expect(result).toMatchObject({ error: { scoringMode: expect.any(Array) } })
    expect(competitionCreateMock).not.toHaveBeenCalled()
  })

  it("liefert Fehler wenn Disziplin nicht existiert", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    disciplineFindUniqueMock.mockResolvedValue(null)
    const result = await createCompetition(
      null,
      makeFormData({
        name: "Liga A",
        type: "LEAGUE",
        scoringMode: "RINGTEILER",
        disciplineId: "d99",
      })
    )
    expect(result).toEqual({ error: "Disziplin nicht gefunden." })
    expect(competitionCreateMock).not.toHaveBeenCalled()
  })

  it("legt Wettbewerb an und gibt success zurück", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionCreateMock.mockResolvedValue({ id: "comp-1" })
    const result = await createCompetition(
      null,
      makeFormData({
        name: "Winterliga 2026",
        type: "LEAGUE",
        scoringMode: "RINGTEILER",
        disciplineId: "d1",
      })
    )
    expect(result).toMatchObject({ success: true })
    expect(competitionCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Winterliga 2026",
        disciplineId: "d1",
        createdByUserId: "u1",
      }),
      select: expect.anything(),
    })
    expect(revalidatePathMock).toHaveBeenCalled()
  })
})

// ─── updateCompetition ────────────────────────────────────────────────────────

describe("updateCompetition", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    competitionUpdateMock.mockResolvedValue({})
    competitionFindUniqueMock.mockResolvedValue({
      id: "c1",
      type: "LEAGUE",
      scoringMode: "RINGTEILER",
    })
    matchupCountMock.mockResolvedValue(0)
  })

  it("liefert Fehler ohne Session", async () => {
    getAuthSessionMock.mockResolvedValue(null)
    const result = await updateCompetition("c1", null, makeFormData({ name: "Liga B" }))
    expect(result).toEqual({ error: "Nicht angemeldet" })
  })

  it("liefert Fehler wenn kein Admin", async () => {
    getAuthSessionMock.mockResolvedValue(userSession)
    const result = await updateCompetition("c1", null, makeFormData({ name: "Liga B" }))
    expect(result).toEqual({ error: "Keine Berechtigung" })
  })

  it("liefert Fehler wenn Wettbewerb nicht gefunden", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionFindUniqueMock.mockResolvedValue(null)
    const result = await updateCompetition("c99", null, makeFormData({ name: "Liga B" }))
    expect(result).toEqual({ error: "Wettbewerb nicht gefunden." })
  })

  it("ignoriert disciplineId im Update", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    await updateCompetition(
      "c1",
      null,
      makeFormData({ name: "Liga B", scoringMode: "RINGTEILER", disciplineId: "d-neu" })
    )
    expect(competitionUpdateMock).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: expect.not.objectContaining({ disciplineId: expect.anything() }),
    })
  })

  it("aktualisiert Name und gibt success zurück", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const result = await updateCompetition(
      "c1",
      null,
      makeFormData({ name: "Neuer Wettbewerb", scoringMode: "RINGTEILER" })
    )
    expect(result).toEqual({ success: true })
    expect(competitionUpdateMock).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: expect.objectContaining({ name: "Neuer Wettbewerb" }),
    })
    expect(revalidatePathMock).toHaveBeenCalled()
  })
})

// ─── setCompetitionStatus ─────────────────────────────────────────────────────

describe("setCompetitionStatus", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    competitionUpdateMock.mockResolvedValue({})
  })

  it("liefert Fehler ohne Session", async () => {
    getAuthSessionMock.mockResolvedValue(null)
    expect(await setCompetitionStatus("c1", "COMPLETED")).toEqual({ error: "Nicht angemeldet" })
  })

  it("liefert Fehler wenn kein Admin", async () => {
    getAuthSessionMock.mockResolvedValue(userSession)
    competitionFindUniqueMock.mockResolvedValue({
      id: "c1",
      name: "Winterliga 2026",
      status: "ACTIVE",
    })
    expect(await setCompetitionStatus("c1", "COMPLETED")).toEqual({ error: "Keine Berechtigung" })
  })

  it("blockiert ungültigen Übergang ACTIVE → ARCHIVED", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionFindUniqueMock.mockResolvedValue({
      id: "c1",
      name: "Winterliga 2026",
      status: "ACTIVE",
    })
    const result = await setCompetitionStatus("c1", "ARCHIVED")
    expect(result).toMatchObject({ error: expect.stringContaining("nicht erlaubt") })
    expect(competitionUpdateMock).not.toHaveBeenCalled()
  })

  it("blockiert ungültigen Übergang ARCHIVED → ACTIVE", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionFindUniqueMock.mockResolvedValue({
      id: "c1",
      name: "Winterliga 2026",
      status: "ARCHIVED",
    })
    const result = await setCompetitionStatus("c1", "ACTIVE")
    expect(result).toMatchObject({ error: expect.stringContaining("nicht erlaubt") })
  })

  it("erlaubt Übergang ACTIVE → COMPLETED", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionFindUniqueMock.mockResolvedValue({
      id: "c1",
      name: "Winterliga 2026",
      status: "ACTIVE",
    })
    const result = await setCompetitionStatus("c1", "COMPLETED")
    expect(result).toEqual({ success: true })
    expect(competitionUpdateMock).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { status: "COMPLETED" },
    })
  })

  it("erlaubt Übergang COMPLETED → ARCHIVED", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionFindUniqueMock.mockResolvedValue({
      id: "c1",
      name: "Winterliga 2026",
      status: "COMPLETED",
    })
    const result = await setCompetitionStatus("c1", "ARCHIVED")
    expect(result).toEqual({ success: true })
    expect(competitionUpdateMock).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { status: "ARCHIVED" },
    })
  })

  it("erlaubt Übergang COMPLETED → ACTIVE (wieder öffnen)", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionFindUniqueMock.mockResolvedValue({
      id: "c1",
      name: "Winterliga 2026",
      status: "COMPLETED",
    })
    const result = await setCompetitionStatus("c1", "ACTIVE")
    expect(result).toEqual({ success: true })
    expect(competitionUpdateMock).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { status: "ACTIVE" },
    })
  })

  it("erlaubt Übergang ARCHIVED → COMPLETED (unarchivieren)", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionFindUniqueMock.mockResolvedValue({
      id: "c1",
      name: "Winterliga 2026",
      status: "ARCHIVED",
    })
    const result = await setCompetitionStatus("c1", "COMPLETED")
    expect(result).toEqual({ success: true })
    expect(competitionUpdateMock).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { status: "COMPLETED" },
    })
  })
})

// ─── deleteCompetition ────────────────────────────────────────────────────────

describe("deleteCompetition", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    competitionDeleteMock.mockResolvedValue({})
    competitionFindUniqueMock.mockResolvedValue({ id: "c1" })
    competitionParticipantCountMock.mockResolvedValue(0)
    matchupCountMock.mockResolvedValue(0)
    playoffMatchCountMock.mockResolvedValue(0)
  })

  it("liefert Fehler ohne Session", async () => {
    getAuthSessionMock.mockResolvedValue(null)
    expect(await deleteCompetition("c1")).toEqual({ error: "Nicht angemeldet" })
  })

  it("liefert Fehler wenn kein Admin", async () => {
    getAuthSessionMock.mockResolvedValue(userSession)
    expect(await deleteCompetition("c1")).toEqual({ error: "Keine Berechtigung" })
  })

  it("erlaubt MANAGER das Löschen (ohne Daten)", async () => {
    getAuthSessionMock.mockResolvedValue(managerSession)
    competitionFindUniqueMock.mockResolvedValue({ id: "c1" })
    competitionParticipantCountMock.mockResolvedValue(0)
    matchupCountMock.mockResolvedValue(0)
    playoffMatchCountMock.mockResolvedValue(0)
    competitionDeleteMock.mockResolvedValue({})
    const result = await deleteCompetition("c1")
    expect(result).toEqual({ success: true })
  })

  it("liefert Fehler wenn Wettbewerb nicht gefunden", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionFindUniqueMock.mockResolvedValue(null)
    expect(await deleteCompetition("c99")).toEqual({ error: "Wettbewerb nicht gefunden." })
  })

  it("blockiert Löschen wenn Teilnehmer vorhanden", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionParticipantCountMock.mockResolvedValue(3)
    const result = await deleteCompetition("c1")
    expect(result).toMatchObject({ error: expect.stringContaining("Daten verknüpft") })
    expect(competitionDeleteMock).not.toHaveBeenCalled()
  })

  it("blockiert Löschen wenn Paarungen vorhanden", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    matchupCountMock.mockResolvedValue(1)
    const result = await deleteCompetition("c1")
    expect(result).toMatchObject({ error: expect.stringContaining("Daten verknüpft") })
    expect(competitionDeleteMock).not.toHaveBeenCalled()
  })

  it("löscht Wettbewerb ohne abhängige Daten", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const result = await deleteCompetition("c1")
    expect(result).toEqual({ success: true })
    expect(competitionDeleteMock).toHaveBeenCalledWith({ where: { id: "c1" } })
    expect(revalidatePathMock).toHaveBeenCalled()
  })
})

// ─── forceDeleteCompetition ───────────────────────────────────────────────────

describe("forceDeleteCompetition", () => {
  const mockTx = {
    competitionParticipant: { findMany: vi.fn(), deleteMany: vi.fn() },
    matchup: { findMany: vi.fn(), deleteMany: vi.fn() },
    series: { findMany: vi.fn(), deleteMany: vi.fn() },
    playoffMatch: { findMany: vi.fn(), deleteMany: vi.fn() },
    playoffDuel: { findMany: vi.fn(), deleteMany: vi.fn() },
    playoffDuelResult: { deleteMany: vi.fn() },
    auditLog: { deleteMany: vi.fn() },
    eventTeam: { deleteMany: vi.fn() },
    competition: { delete: vi.fn() },
  }

  function setupEmptyTx() {
    mockTx.competitionParticipant.findMany.mockResolvedValue([])
    mockTx.matchup.findMany.mockResolvedValue([])
    mockTx.series.findMany.mockResolvedValue([])
    mockTx.playoffMatch.findMany.mockResolvedValue([])
    mockTx.playoffDuel.findMany.mockResolvedValue([])
    mockTx.playoffDuelResult.deleteMany.mockResolvedValue({ count: 0 })
    mockTx.playoffDuel.deleteMany.mockResolvedValue({ count: 0 })
    mockTx.playoffMatch.deleteMany.mockResolvedValue({ count: 0 })
    mockTx.series.deleteMany.mockResolvedValue({ count: 0 })
    mockTx.matchup.deleteMany.mockResolvedValue({ count: 0 })
    mockTx.auditLog.deleteMany.mockResolvedValue({ count: 0 })
    mockTx.eventTeam.deleteMany.mockResolvedValue({ count: 0 })
    mockTx.competitionParticipant.deleteMany.mockResolvedValue({ count: 0 })
    mockTx.competition.delete.mockResolvedValue({})
    transactionMock.mockImplementation(async (fn: (tx: typeof mockTx) => Promise<void>) =>
      fn(mockTx)
    )
  }

  beforeEach(() => {
    vi.resetAllMocks()
    competitionFindUniqueMock.mockResolvedValue({ id: "c1", name: "Winterliga 2026" })
    setupEmptyTx()
  })

  it("liefert Fehler ohne Session", async () => {
    getAuthSessionMock.mockResolvedValue(null)
    const result = await forceDeleteCompetition("c1", "Winterliga 2026")
    expect(result).toEqual({ error: "Nicht angemeldet" })
    expect(transactionMock).not.toHaveBeenCalled()
  })

  it("liefert Fehler wenn kein Admin", async () => {
    getAuthSessionMock.mockResolvedValue(userSession)
    const result = await forceDeleteCompetition("c1", "Winterliga 2026")
    expect(result).toEqual({ error: "Keine Berechtigung" })
    expect(transactionMock).not.toHaveBeenCalled()
  })

  it("verweigert MANAGER das endgültige Löschen", async () => {
    getAuthSessionMock.mockResolvedValue(managerSession)
    const result = await forceDeleteCompetition("c1", "Testbewerb")
    expect(result).toEqual({ error: "Keine Berechtigung" })
  })

  it("liefert Fehler wenn Wettbewerb nicht gefunden", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionFindUniqueMock.mockResolvedValue(null)
    const result = await forceDeleteCompetition("c99", "Winterliga 2026")
    expect(result).toEqual({ error: "Wettbewerb nicht gefunden." })
    expect(transactionMock).not.toHaveBeenCalled()
  })

  it("liefert Fehler bei falschem Bestätigungsnamen", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const result = await forceDeleteCompetition("c1", "Falscher Wettbewerb")
    expect(result).toMatchObject({ error: expect.stringContaining("stimmt nicht") })
    expect(transactionMock).not.toHaveBeenCalled()
  })

  it("löscht leeren Wettbewerb (ohne abhängige Daten)", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const result = await forceDeleteCompetition("c1", "Winterliga 2026")
    expect(result).toEqual({ success: true })
    expect(mockTx.competition.delete).toHaveBeenCalledWith({ where: { id: "c1" } })
    expect(revalidatePathMock).toHaveBeenCalled()
  })

  it("löscht Wettbewerb mit allen abhängigen Daten", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)

    mockTx.competitionParticipant.findMany.mockResolvedValue([{ id: "cp1" }, { id: "cp2" }])
    mockTx.matchup.findMany.mockResolvedValue([{ id: "mu1" }, { id: "mu2" }])
    mockTx.series.findMany.mockResolvedValue([{ id: "mr1" }])
    mockTx.playoffMatch.findMany.mockResolvedValue([{ id: "pm1" }])
    mockTx.playoffDuel.findMany.mockResolvedValue([{ id: "pd1" }, { id: "pd2" }])

    const result = await forceDeleteCompetition("c1", "Winterliga 2026")
    expect(result).toEqual({ success: true })

    // Bottom-up Löschreihenfolge
    expect(mockTx.playoffDuelResult.deleteMany).toHaveBeenCalledWith({
      where: { duelId: { in: ["pd1", "pd2"] } },
    })
    expect(mockTx.playoffDuel.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["pd1", "pd2"] } },
    })
    expect(mockTx.playoffMatch.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["pm1"] } },
    })
    expect(mockTx.series.deleteMany).toHaveBeenCalledWith({
      where: { matchupId: { in: ["mu1", "mu2"] } },
    })
    expect(mockTx.matchup.deleteMany).toHaveBeenCalledWith({ where: { competitionId: "c1" } })
    expect(mockTx.auditLog.deleteMany).toHaveBeenCalledWith({
      where: { competitionId: "c1" },
    })
    expect(mockTx.competitionParticipant.deleteMany).toHaveBeenCalledWith({
      where: { competitionId: "c1" },
    })
    expect(mockTx.competition.delete).toHaveBeenCalledWith({ where: { id: "c1" } })
  })

  it("liefert Fehler wenn Transaktion fehlschlägt", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    transactionMock.mockRejectedValue(new Error("DB error"))
    const result = await forceDeleteCompetition("c1", "Winterliga 2026")
    expect(result).toMatchObject({ error: expect.stringContaining("nicht gelöscht") })
  })
})

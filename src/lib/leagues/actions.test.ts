import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  getAuthSessionMock,
  revalidatePathMock,
  leagueFindUniqueMock,
  leagueDeleteMock,
  disciplineFindUniqueMock,
  leagueCreateMock,
  leagueUpdateMock,
  leagueParticipantCountMock,
  matchupCountMock,
  playoffMatchCountMock,
  transactionMock,
} = vi.hoisted(() => ({
  getAuthSessionMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  leagueFindUniqueMock: vi.fn(),
  leagueDeleteMock: vi.fn(),
  disciplineFindUniqueMock: vi.fn(),
  leagueCreateMock: vi.fn(),
  leagueUpdateMock: vi.fn(),
  leagueParticipantCountMock: vi.fn(),
  matchupCountMock: vi.fn(),
  playoffMatchCountMock: vi.fn(),
  transactionMock: vi.fn(),
}))

vi.mock("@/lib/auth-helpers", () => ({ getAuthSession: getAuthSessionMock }))
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }))
vi.mock("@/lib/db", () => ({
  db: {
    league: {
      findUnique: leagueFindUniqueMock,
      create: leagueCreateMock,
      update: leagueUpdateMock,
      delete: leagueDeleteMock,
    },
    discipline: {
      findUnique: disciplineFindUniqueMock,
    },
    leagueParticipant: { count: leagueParticipantCountMock },
    matchup: { count: matchupCountMock },
    playoffMatch: { count: playoffMatchCountMock },
    $transaction: transactionMock,
  },
}))

import {
  createLeague,
  updateLeague,
  setLeagueStatus,
  deleteLeague,
  forceDeleteLeague,
} from "@/lib/leagues/actions"

const adminSession = { user: { id: "u1", role: "ADMIN" } }
const userSession = { user: { id: "u2", role: "USER" } }

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

// ─── createLeague ─────────────────────────────────────────────────────────────

describe("createLeague", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    leagueCreateMock.mockResolvedValue({})
    disciplineFindUniqueMock.mockResolvedValue({ id: "d1" })
  })

  it("liefert Fehler ohne Session", async () => {
    getAuthSessionMock.mockResolvedValue(null)
    const result = await createLeague(null, makeFormData({ name: "Liga A", disciplineId: "d1" }))
    expect(result).toEqual({ error: "Nicht angemeldet" })
    expect(leagueCreateMock).not.toHaveBeenCalled()
  })

  it("liefert Fehler wenn kein Admin", async () => {
    getAuthSessionMock.mockResolvedValue(userSession)
    const result = await createLeague(null, makeFormData({ name: "Liga A", disciplineId: "d1" }))
    expect(result).toEqual({ error: "Keine Berechtigung" })
    expect(leagueCreateMock).not.toHaveBeenCalled()
  })

  it("liefert Validierungsfehler bei leerem Namen", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const result = await createLeague(null, makeFormData({ name: "", disciplineId: "d1" }))
    expect(result).toMatchObject({ error: { name: expect.any(Array) } })
    expect(leagueCreateMock).not.toHaveBeenCalled()
  })

  it("liefert Validierungsfehler bei fehlender Disziplin", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const result = await createLeague(null, makeFormData({ name: "Liga A", disciplineId: "" }))
    expect(result).toMatchObject({ error: { disciplineId: expect.any(Array) } })
    expect(leagueCreateMock).not.toHaveBeenCalled()
  })

  it("liefert Fehler wenn Disziplin nicht existiert", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    disciplineFindUniqueMock.mockResolvedValue(null)
    const result = await createLeague(null, makeFormData({ name: "Liga A", disciplineId: "d99" }))
    expect(result).toEqual({ error: "Disziplin nicht gefunden." })
    expect(leagueCreateMock).not.toHaveBeenCalled()
  })

  it("legt Liga an und gibt success zurück", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const result = await createLeague(
      null,
      makeFormData({ name: "Winterliga 2026", disciplineId: "d1" })
    )
    expect(result).toEqual({ success: true })
    expect(leagueCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Winterliga 2026",
        disciplineId: "d1",
        createdByUserId: "u1",
      }),
    })
    expect(revalidatePathMock).toHaveBeenCalled()
  })
})

// ─── updateLeague ─────────────────────────────────────────────────────────────

describe("updateLeague", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    leagueUpdateMock.mockResolvedValue({})
    leagueFindUniqueMock.mockResolvedValue({ id: "l1" })
  })

  it("liefert Fehler ohne Session", async () => {
    getAuthSessionMock.mockResolvedValue(null)
    const result = await updateLeague("l1", null, makeFormData({ name: "Liga B" }))
    expect(result).toEqual({ error: "Nicht angemeldet" })
  })

  it("liefert Fehler wenn kein Admin", async () => {
    getAuthSessionMock.mockResolvedValue(userSession)
    const result = await updateLeague("l1", null, makeFormData({ name: "Liga B" }))
    expect(result).toEqual({ error: "Keine Berechtigung" })
  })

  it("liefert Fehler wenn Liga nicht gefunden", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    leagueFindUniqueMock.mockResolvedValue(null)
    const result = await updateLeague("l99", null, makeFormData({ name: "Liga B" }))
    expect(result).toEqual({ error: "Liga nicht gefunden." })
  })

  it("ignoriert disciplineId im Update", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    await updateLeague("l1", null, makeFormData({ name: "Liga B", disciplineId: "d-neu" }))
    expect(leagueUpdateMock).toHaveBeenCalledWith({
      where: { id: "l1" },
      data: expect.not.objectContaining({ disciplineId: expect.anything() }),
    })
  })

  it("aktualisiert Name und gibt success zurück", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const result = await updateLeague("l1", null, makeFormData({ name: "Neue Liga" }))
    expect(result).toEqual({ success: true })
    expect(leagueUpdateMock).toHaveBeenCalledWith({
      where: { id: "l1" },
      data: expect.objectContaining({ name: "Neue Liga" }),
    })
    expect(revalidatePathMock).toHaveBeenCalled()
  })
})

// ─── setLeagueStatus ──────────────────────────────────────────────────────────

describe("setLeagueStatus", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    leagueUpdateMock.mockResolvedValue({})
  })

  it("liefert Fehler ohne Session", async () => {
    getAuthSessionMock.mockResolvedValue(null)
    expect(await setLeagueStatus("l1", "COMPLETED")).toEqual({ error: "Nicht angemeldet" })
  })

  it("liefert Fehler wenn kein Admin", async () => {
    getAuthSessionMock.mockResolvedValue(userSession)
    leagueFindUniqueMock.mockResolvedValue({ id: "l1", status: "ACTIVE" })
    expect(await setLeagueStatus("l1", "COMPLETED")).toEqual({ error: "Keine Berechtigung" })
  })

  it("blockiert ungültigen Übergang ACTIVE → ARCHIVED", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    leagueFindUniqueMock.mockResolvedValue({ id: "l1", status: "ACTIVE" })
    const result = await setLeagueStatus("l1", "ARCHIVED")
    expect(result).toMatchObject({ error: expect.stringContaining("nicht erlaubt") })
    expect(leagueUpdateMock).not.toHaveBeenCalled()
  })

  it("blockiert ungültigen Übergang ARCHIVED → ACTIVE", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    leagueFindUniqueMock.mockResolvedValue({ id: "l1", status: "ARCHIVED" })
    const result = await setLeagueStatus("l1", "ACTIVE")
    expect(result).toMatchObject({ error: expect.stringContaining("nicht erlaubt") })
  })

  it("erlaubt Übergang ACTIVE → COMPLETED", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    leagueFindUniqueMock.mockResolvedValue({ id: "l1", status: "ACTIVE" })
    const result = await setLeagueStatus("l1", "COMPLETED")
    expect(result).toEqual({ success: true })
    expect(leagueUpdateMock).toHaveBeenCalledWith({
      where: { id: "l1" },
      data: { status: "COMPLETED" },
    })
  })

  it("erlaubt Übergang COMPLETED → ARCHIVED", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    leagueFindUniqueMock.mockResolvedValue({ id: "l1", status: "COMPLETED" })
    const result = await setLeagueStatus("l1", "ARCHIVED")
    expect(result).toEqual({ success: true })
    expect(leagueUpdateMock).toHaveBeenCalledWith({
      where: { id: "l1" },
      data: { status: "ARCHIVED" },
    })
  })

  it("erlaubt Übergang COMPLETED → ACTIVE (wieder öffnen)", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    leagueFindUniqueMock.mockResolvedValue({ id: "l1", status: "COMPLETED" })
    const result = await setLeagueStatus("l1", "ACTIVE")
    expect(result).toEqual({ success: true })
    expect(leagueUpdateMock).toHaveBeenCalledWith({
      where: { id: "l1" },
      data: { status: "ACTIVE" },
    })
  })

  it("erlaubt Übergang ARCHIVED → COMPLETED (unarchivieren)", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    leagueFindUniqueMock.mockResolvedValue({ id: "l1", status: "ARCHIVED" })
    const result = await setLeagueStatus("l1", "COMPLETED")
    expect(result).toEqual({ success: true })
    expect(leagueUpdateMock).toHaveBeenCalledWith({
      where: { id: "l1" },
      data: { status: "COMPLETED" },
    })
  })
})

// ─── deleteLeague ─────────────────────────────────────────────────────────────

describe("deleteLeague", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    leagueDeleteMock.mockResolvedValue({})
    leagueFindUniqueMock.mockResolvedValue({ id: "l1" })
    leagueParticipantCountMock.mockResolvedValue(0)
    matchupCountMock.mockResolvedValue(0)
    playoffMatchCountMock.mockResolvedValue(0)
  })

  it("liefert Fehler ohne Session", async () => {
    getAuthSessionMock.mockResolvedValue(null)
    expect(await deleteLeague("l1")).toEqual({ error: "Nicht angemeldet" })
  })

  it("liefert Fehler wenn kein Admin", async () => {
    getAuthSessionMock.mockResolvedValue(userSession)
    expect(await deleteLeague("l1")).toEqual({ error: "Keine Berechtigung" })
  })

  it("liefert Fehler wenn Liga nicht gefunden", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    leagueFindUniqueMock.mockResolvedValue(null)
    expect(await deleteLeague("l99")).toEqual({ error: "Liga nicht gefunden." })
  })

  it("blockiert Löschen wenn Teilnehmer vorhanden", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    leagueParticipantCountMock.mockResolvedValue(3)
    const result = await deleteLeague("l1")
    expect(result).toMatchObject({ error: expect.stringContaining("Daten verknüpft") })
    expect(leagueDeleteMock).not.toHaveBeenCalled()
  })

  it("blockiert Löschen wenn Paarungen vorhanden", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    matchupCountMock.mockResolvedValue(1)
    const result = await deleteLeague("l1")
    expect(result).toMatchObject({ error: expect.stringContaining("Daten verknüpft") })
    expect(leagueDeleteMock).not.toHaveBeenCalled()
  })

  it("löscht Liga ohne abhängige Daten", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const result = await deleteLeague("l1")
    expect(result).toEqual({ success: true })
    expect(leagueDeleteMock).toHaveBeenCalledWith({ where: { id: "l1" } })
    expect(revalidatePathMock).toHaveBeenCalled()
  })
})

// ─── forceDeleteLeague ───────────────────────────────────────────────────────

describe("forceDeleteLeague", () => {
  const mockTx = {
    leagueParticipant: { findMany: vi.fn(), deleteMany: vi.fn() },
    matchup: { findMany: vi.fn(), deleteMany: vi.fn() },
    matchResult: { findMany: vi.fn(), deleteMany: vi.fn() },
    playoffMatch: { findMany: vi.fn(), deleteMany: vi.fn() },
    playoffDuel: { findMany: vi.fn(), deleteMany: vi.fn() },
    playoffDuelResult: { deleteMany: vi.fn() },
    auditLog: { deleteMany: vi.fn() },
    league: { delete: vi.fn() },
  }

  function setupEmptyTx() {
    mockTx.leagueParticipant.findMany.mockResolvedValue([])
    mockTx.matchup.findMany.mockResolvedValue([])
    mockTx.matchResult.findMany.mockResolvedValue([])
    mockTx.playoffMatch.findMany.mockResolvedValue([])
    mockTx.playoffDuel.findMany.mockResolvedValue([])
    mockTx.playoffDuelResult.deleteMany.mockResolvedValue({ count: 0 })
    mockTx.playoffDuel.deleteMany.mockResolvedValue({ count: 0 })
    mockTx.playoffMatch.deleteMany.mockResolvedValue({ count: 0 })
    mockTx.matchResult.deleteMany.mockResolvedValue({ count: 0 })
    mockTx.matchup.deleteMany.mockResolvedValue({ count: 0 })
    mockTx.auditLog.deleteMany.mockResolvedValue({ count: 0 })
    mockTx.leagueParticipant.deleteMany.mockResolvedValue({ count: 0 })
    mockTx.league.delete.mockResolvedValue({})
    transactionMock.mockImplementation(async (fn: (tx: typeof mockTx) => Promise<void>) =>
      fn(mockTx)
    )
  }

  beforeEach(() => {
    vi.resetAllMocks()
    leagueFindUniqueMock.mockResolvedValue({ id: "l1", name: "Winterliga 2026" })
    setupEmptyTx()
  })

  it("liefert Fehler ohne Session", async () => {
    getAuthSessionMock.mockResolvedValue(null)
    const result = await forceDeleteLeague("l1", "Winterliga 2026")
    expect(result).toEqual({ error: "Nicht angemeldet" })
    expect(transactionMock).not.toHaveBeenCalled()
  })

  it("liefert Fehler wenn kein Admin", async () => {
    getAuthSessionMock.mockResolvedValue(userSession)
    const result = await forceDeleteLeague("l1", "Winterliga 2026")
    expect(result).toEqual({ error: "Keine Berechtigung" })
    expect(transactionMock).not.toHaveBeenCalled()
  })

  it("liefert Fehler wenn Liga nicht gefunden", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    leagueFindUniqueMock.mockResolvedValue(null)
    const result = await forceDeleteLeague("l99", "Winterliga 2026")
    expect(result).toEqual({ error: "Liga nicht gefunden." })
    expect(transactionMock).not.toHaveBeenCalled()
  })

  it("liefert Fehler bei falschem Bestätigungsnamen", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const result = await forceDeleteLeague("l1", "Falsche Liga")
    expect(result).toMatchObject({ error: expect.stringContaining("stimmt nicht") })
    expect(transactionMock).not.toHaveBeenCalled()
  })

  it("löscht leere Liga (ohne abhängige Daten)", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const result = await forceDeleteLeague("l1", "Winterliga 2026")
    expect(result).toEqual({ success: true })
    expect(mockTx.league.delete).toHaveBeenCalledWith({ where: { id: "l1" } })
    expect(revalidatePathMock).toHaveBeenCalled()
  })

  it("löscht Liga mit allen abhängigen Daten", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)

    mockTx.leagueParticipant.findMany.mockResolvedValue([{ id: "lp1" }, { id: "lp2" }])
    mockTx.matchup.findMany.mockResolvedValue([{ id: "mu1" }, { id: "mu2" }])
    mockTx.matchResult.findMany.mockResolvedValue([{ id: "mr1" }])
    mockTx.playoffMatch.findMany.mockResolvedValue([{ id: "pm1" }])
    mockTx.playoffDuel.findMany.mockResolvedValue([{ id: "pd1" }, { id: "pd2" }])

    const result = await forceDeleteLeague("l1", "Winterliga 2026")
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
    expect(mockTx.matchResult.deleteMany).toHaveBeenCalledWith({
      where: { matchupId: { in: ["mu1", "mu2"] } },
    })
    expect(mockTx.matchup.deleteMany).toHaveBeenCalledWith({ where: { leagueId: "l1" } })
    expect(mockTx.auditLog.deleteMany).toHaveBeenCalledWith({
      where: { leagueId: "l1" },
    })
    expect(mockTx.leagueParticipant.deleteMany).toHaveBeenCalledWith({
      where: { leagueId: "l1" },
    })
    expect(mockTx.league.delete).toHaveBeenCalledWith({ where: { id: "l1" } })
  })

  it("liefert Fehler wenn Transaktion fehlschlägt", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    transactionMock.mockRejectedValue(new Error("DB error"))
    const result = await forceDeleteLeague("l1", "Winterliga 2026")
    expect(result).toMatchObject({ error: expect.stringContaining("nicht gelöscht") })
  })
})

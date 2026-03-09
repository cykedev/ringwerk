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
  },
}))

import { createLeague, updateLeague, setLeagueStatus, deleteLeague } from "@/lib/leagues/actions"

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

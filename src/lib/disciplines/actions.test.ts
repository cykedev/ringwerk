import { beforeEach, describe, expect, it, vi } from "vitest"

const { getAuthSessionMock, revalidatePathMock, findUniqueMock, createMock, updateMock, deleteMock, leagueCountMock } =
  vi.hoisted(() => ({
    getAuthSessionMock: vi.fn(),
    revalidatePathMock: vi.fn(),
    findUniqueMock: vi.fn(),
    createMock: vi.fn(),
    updateMock: vi.fn(),
    deleteMock: vi.fn(),
    leagueCountMock: vi.fn(),
  }))

vi.mock("@/lib/auth-helpers", () => ({ getAuthSession: getAuthSessionMock }))
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }))
vi.mock("@/lib/db", () => ({
  db: {
    discipline: {
      findUnique: findUniqueMock,
      create: createMock,
      update: updateMock,
      delete: deleteMock,
    },
    league: { count: leagueCountMock },
  },
}))

import {
  createDiscipline,
  deleteDiscipline,
  setDisciplineArchived,
  updateDiscipline,
} from "@/lib/disciplines/actions"

const adminSession = { user: { id: "u1", role: "ADMIN" } }
const userSession = { user: { id: "u2", role: "USER" } }

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

// ─── createDiscipline ────────────────────────────────────────────────────────

describe("createDiscipline", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    createMock.mockResolvedValue({})
  })

  it("liefert Fehler ohne Session", async () => {
    getAuthSessionMock.mockResolvedValue(null)
    const result = await createDiscipline(null, makeFormData({ name: "LP", scoringType: "WHOLE" }))
    expect(result).toEqual({ error: "Nicht angemeldet" })
    expect(createMock).not.toHaveBeenCalled()
  })

  it("liefert Fehler wenn kein Admin", async () => {
    getAuthSessionMock.mockResolvedValue(userSession)
    const result = await createDiscipline(null, makeFormData({ name: "LP", scoringType: "WHOLE" }))
    expect(result).toEqual({ error: "Keine Berechtigung" })
    expect(createMock).not.toHaveBeenCalled()
  })

  it("liefert Validierungsfehler bei leerem Namen", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const result = await createDiscipline(null, makeFormData({ name: "", scoringType: "WHOLE" }))
    expect(result).toMatchObject({ error: { name: expect.any(Array) } })
    expect(createMock).not.toHaveBeenCalled()
  })

  it("liefert Validierungsfehler bei ungültiger Wertungsart", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const result = await createDiscipline(
      null,
      makeFormData({ name: "LP", scoringType: "INVALID" })
    )
    expect(result).toMatchObject({ error: { scoringType: expect.any(Array) } })
  })

  it("legt Disziplin an und gibt success zurück", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const result = await createDiscipline(
      null,
      makeFormData({ name: "Luftpistole", scoringType: "WHOLE" })
    )
    expect(result).toEqual({ success: true })
    expect(createMock).toHaveBeenCalledWith({
      data: { name: "Luftpistole", scoringType: "WHOLE" },
    })
    expect(revalidatePathMock).toHaveBeenCalled()
  })
})

// ─── updateDiscipline ────────────────────────────────────────────────────────

describe("updateDiscipline", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    updateMock.mockResolvedValue({})
  })

  it("liefert Fehler ohne Session", async () => {
    getAuthSessionMock.mockResolvedValue(null)
    const result = await updateDiscipline(
      "d1",
      null,
      makeFormData({ name: "LP", scoringType: "WHOLE" })
    )
    expect(result).toEqual({ error: "Nicht angemeldet" })
  })

  it("liefert Fehler wenn kein Admin", async () => {
    getAuthSessionMock.mockResolvedValue(userSession)
    findUniqueMock.mockResolvedValue({ id: "d1", scoringType: "WHOLE" })
    const result = await updateDiscipline(
      "d1",
      null,
      makeFormData({ name: "LP", scoringType: "WHOLE" })
    )
    expect(result).toEqual({ error: "Keine Berechtigung" })
  })

  it("liefert Fehler wenn Disziplin nicht gefunden", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    findUniqueMock.mockResolvedValue(null)
    const result = await updateDiscipline(
      "d1",
      null,
      makeFormData({ name: "LP", scoringType: "WHOLE" })
    )
    expect(result).toEqual({ error: "Disziplin nicht gefunden." })
  })

  it("blockiert Wertungsartwechsel wenn Ligen vorhanden", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    findUniqueMock.mockResolvedValue({ id: "d1", scoringType: "WHOLE" })
    leagueCountMock.mockResolvedValue(2)

    const result = await updateDiscipline(
      "d1",
      null,
      makeFormData({ name: "LP", scoringType: "DECIMAL" })
    )

    expect(result).toMatchObject({ error: expect.stringContaining("Wertungsart") })
    expect(updateMock).not.toHaveBeenCalled()
  })

  it("erlaubt Wertungsartwechsel ohne Ligen", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    findUniqueMock.mockResolvedValue({ id: "d1", scoringType: "WHOLE" })
    leagueCountMock.mockResolvedValue(0)

    const result = await updateDiscipline(
      "d1",
      null,
      makeFormData({ name: "LP", scoringType: "DECIMAL" })
    )

    expect(result).toEqual({ success: true })
    expect(updateMock).toHaveBeenCalled()
  })
})

// ─── deleteDiscipline ────────────────────────────────────────────────────────

describe("deleteDiscipline", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    deleteMock.mockResolvedValue({})
  })

  it("liefert Fehler ohne Session", async () => {
    getAuthSessionMock.mockResolvedValue(null)
    expect(await deleteDiscipline("d1")).toEqual({ error: "Nicht angemeldet" })
  })

  it("liefert Fehler wenn kein Admin", async () => {
    getAuthSessionMock.mockResolvedValue(userSession)
    findUniqueMock.mockResolvedValue({ id: "d1" })
    expect(await deleteDiscipline("d1")).toEqual({ error: "Keine Berechtigung" })
  })

  it("blockiert Löschen wenn Ligen vorhanden", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    findUniqueMock.mockResolvedValue({ id: "d1" })
    leagueCountMock.mockResolvedValue(1)

    const result = await deleteDiscipline("d1")

    expect(result).toMatchObject({ error: expect.stringContaining("Ligen") })
    expect(deleteMock).not.toHaveBeenCalled()
  })

  it("löscht Disziplin ohne Ligen", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    findUniqueMock.mockResolvedValue({ id: "d1" })
    leagueCountMock.mockResolvedValue(0)

    const result = await deleteDiscipline("d1")

    expect(result).toEqual({ success: true })
    expect(deleteMock).toHaveBeenCalledWith({ where: { id: "d1" } })
    expect(revalidatePathMock).toHaveBeenCalled()
  })
})

// ─── setDisciplineArchived ───────────────────────────────────────────────────

describe("setDisciplineArchived", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    updateMock.mockResolvedValue({})
  })

  it("liefert Fehler ohne Session", async () => {
    getAuthSessionMock.mockResolvedValue(null)
    expect(await setDisciplineArchived("d1", true)).toEqual({ error: "Nicht angemeldet" })
  })

  it("liefert Fehler wenn kein Admin", async () => {
    getAuthSessionMock.mockResolvedValue(userSession)
    findUniqueMock.mockResolvedValue({ id: "d1", isArchived: false })
    expect(await setDisciplineArchived("d1", true)).toEqual({ error: "Keine Berechtigung" })
  })

  it("ist idempotent — kein Update wenn Status bereits korrekt", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    findUniqueMock.mockResolvedValue({ id: "d1", isArchived: true })

    const result = await setDisciplineArchived("d1", true)

    expect(result).toEqual({ success: true })
    expect(updateMock).not.toHaveBeenCalled()
  })

  it("archiviert eine aktive Disziplin", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    findUniqueMock.mockResolvedValue({ id: "d1", isArchived: false })

    const result = await setDisciplineArchived("d1", true)

    expect(result).toEqual({ success: true })
    expect(updateMock).toHaveBeenCalledWith({ where: { id: "d1" }, data: { isArchived: true } })
  })
})

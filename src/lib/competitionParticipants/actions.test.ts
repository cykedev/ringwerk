import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  getAuthSessionMock,
  revalidatePathMock,
  competitionFindUniqueMock,
  competitionParticipantFindUniqueMock,
  competitionParticipantCreateMock,
  competitionParticipantDeleteMock,
  matchupCountMock,
  playoffMatchCountMock,
  participantCreateMock,
  participantDeleteMock,
  seriesDeleteManyMock,
  transactionMock,
} = vi.hoisted(() => ({
  getAuthSessionMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  competitionFindUniqueMock: vi.fn(),
  competitionParticipantFindUniqueMock: vi.fn(),
  competitionParticipantCreateMock: vi.fn(),
  competitionParticipantDeleteMock: vi.fn(),
  matchupCountMock: vi.fn(),
  playoffMatchCountMock: vi.fn(),
  participantCreateMock: vi.fn(),
  participantDeleteMock: vi.fn(),
  seriesDeleteManyMock: vi.fn(),
  transactionMock: vi.fn(),
}))

vi.mock("@/lib/auth-helpers", () => ({ getAuthSession: getAuthSessionMock }))
vi.mock("next/cache", () => ({ revalidatePath: revalidatePathMock }))
vi.mock("@/lib/db", () => ({
  db: {
    competition: { findUnique: competitionFindUniqueMock },
    competitionParticipant: {
      findUnique: competitionParticipantFindUniqueMock,
      findFirst: competitionParticipantFindUniqueMock,
      create: competitionParticipantCreateMock,
      delete: competitionParticipantDeleteMock,
    },
    matchup: { count: matchupCountMock },
    playoffMatch: { count: playoffMatchCountMock },
    participant: {
      create: participantCreateMock,
      delete: participantDeleteMock,
    },
    series: { deleteMany: seriesDeleteManyMock },
    $transaction: transactionMock,
  },
}))

import { enrollParticipant, unenrollParticipant } from "@/lib/competitionParticipants/actions"

const adminSession = { user: { id: "u1", role: "ADMIN" } }
const userSession = { user: { id: "u2", role: "USER" } }

function makeFormData(fields: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

const activeCompetition = { id: "c1", status: "ACTIVE", disciplineId: "d1" }

// ─── enrollParticipant ────────────────────────────────────────────────────────

describe("enrollParticipant", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    competitionFindUniqueMock.mockResolvedValue(activeCompetition)
    competitionParticipantFindUniqueMock.mockResolvedValue(null)
    competitionParticipantCreateMock.mockResolvedValue({})
  })

  it("liefert Fehler ohne Session", async () => {
    getAuthSessionMock.mockResolvedValue(null)
    const result = await enrollParticipant("c1", null, makeFormData({ participantId: "p1" }))
    expect(result).toEqual({ error: "Nicht angemeldet" })
  })

  it("liefert Fehler wenn kein Admin", async () => {
    getAuthSessionMock.mockResolvedValue(userSession)
    const result = await enrollParticipant("c1", null, makeFormData({ participantId: "p1" }))
    expect(result).toEqual({ error: "Keine Berechtigung" })
  })

  it("liefert Fehler wenn Wettbewerb nicht gefunden", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionFindUniqueMock.mockResolvedValue(null)
    const result = await enrollParticipant("c1", null, makeFormData({ participantId: "p1" }))
    expect(result).toEqual({ error: "Wettbewerb nicht gefunden." })
  })

  it("liefert Validierungsfehler wenn kein Teilnehmer und kein Gast", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const result = await enrollParticipant("c1", null, makeFormData({ isGuest: "false" }))
    expect(result).toMatchObject({ error: { participantId: expect.any(Array) } })
    expect(competitionParticipantCreateMock).not.toHaveBeenCalled()
  })

  it("schreibt regulären Teilnehmer ein", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const result = await enrollParticipant(
      "c1",
      null,
      makeFormData({ participantId: "p1", isGuest: "false" })
    )
    expect(result).toEqual({ success: true })
    expect(competitionParticipantCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ participantId: "p1", isGuest: false }),
      })
    )
  })

  it("liefert Fehler bei doppelter Einschreibung", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionParticipantFindUniqueMock.mockResolvedValue({ id: "cp1" })
    const result = await enrollParticipant(
      "c1",
      null,
      makeFormData({ participantId: "p1", isGuest: "false" })
    )
    expect(result).toEqual({ error: "Teilnehmer ist bereits in diesem Wettbewerb eingeschrieben." })
  })

  it("liefert Validierungsfehler wenn Gast ohne Namen", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const result = await enrollParticipant(
      "c1",
      null,
      makeFormData({ isGuest: "true", guestName: "" })
    )
    expect(result).toMatchObject({ error: { guestName: expect.any(Array) } })
    expect(transactionMock).not.toHaveBeenCalled()
  })

  it("schreibt Gast mit Namen ein (stiller Participant-Record)", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    transactionMock.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        participant: {
          create: participantCreateMock.mockResolvedValue({ id: "gp1" }),
        },
        competitionParticipant: {
          create: competitionParticipantCreateMock,
        },
      }
      return fn(tx)
    })
    const result = await enrollParticipant(
      "c1",
      null,
      makeFormData({ isGuest: "true", guestName: "Max Mustermann" })
    )
    expect(result).toEqual({ success: true })
    expect(participantCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          firstName: "Max Mustermann",
          lastName: "",
          isGuestRecord: true,
        }),
      })
    )
    expect(competitionParticipantCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isGuest: true, participantId: "gp1" }),
      })
    )
  })
})

// ─── unenrollParticipant ────────────────────────────────────────────────────

describe("unenrollParticipant", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    matchupCountMock.mockResolvedValue(0)
    competitionParticipantDeleteMock.mockResolvedValue({})
  })

  it("liefert Fehler ohne Session", async () => {
    getAuthSessionMock.mockResolvedValue(null)
    competitionParticipantFindUniqueMock.mockResolvedValue({
      id: "cp1",
      competitionId: "c1",
      participantId: "p1",
      isGuest: false,
    })
    const result = await unenrollParticipant("cp1")
    expect(result).toEqual({ error: "Nicht angemeldet" })
  })

  it("löscht regulären Teilnehmer ohne Cleanup", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionParticipantFindUniqueMock.mockResolvedValue({
      id: "cp1",
      competitionId: "c1",
      participantId: "p1",
      isGuest: false,
    })
    const result = await unenrollParticipant("cp1")
    expect(result).toEqual({ success: true })
    expect(competitionParticipantDeleteMock).toHaveBeenCalledWith({ where: { id: "cp1" } })
    expect(transactionMock).not.toHaveBeenCalled()
  })

  it("löscht Gast inklusive Serien und stillem Participant-Record", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionParticipantFindUniqueMock.mockResolvedValue({
      id: "cp1",
      competitionId: "c1",
      participantId: "gp1",
      isGuest: true,
    })
    transactionMock.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        series: { deleteMany: seriesDeleteManyMock.mockResolvedValue({}) },
        competitionParticipant: { delete: competitionParticipantDeleteMock },
        participant: { delete: participantDeleteMock.mockResolvedValue({}) },
      }
      return fn(tx)
    })
    const result = await unenrollParticipant("cp1")
    expect(result).toEqual({ success: true })
    expect(seriesDeleteManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ participantId: "gp1", competitionId: "c1" }),
      })
    )
    expect(participantDeleteMock).toHaveBeenCalledWith({ where: { id: "gp1" } })
  })
})

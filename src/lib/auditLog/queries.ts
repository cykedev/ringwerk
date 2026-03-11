import { db } from "@/lib/db"

export async function getAuditLogsByLeague(leagueId: string) {
  return db.auditLog.findMany({
    where: { leagueId },
    include: {
      user: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  })
}

export async function getAuditLogs() {
  return db.auditLog.findMany({
    include: {
      user: { select: { name: true } },
      league: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  })
}

export type AuditLogEntry = Awaited<ReturnType<typeof getAuditLogsByLeague>>[number]
export type AuditLogEntryWithLeague = Awaited<ReturnType<typeof getAuditLogs>>[number]

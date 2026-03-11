"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  MoreHorizontal,
  Pencil,
  CheckCircle,
  Archive,
  ArchiveRestore,
  RotateCcw,
  ScrollText,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { setLeagueStatus, deleteLeague } from "@/lib/leagues/actions"
import type { LeagueListItem } from "@/lib/leagues/types"
import type { LeagueStatus } from "@/generated/prisma/client"

interface Props {
  league: LeagueListItem
}

export function LeagueActions({ league }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleStatusChange(status: LeagueStatus, label: string) {
    if (!confirm(`Liga „${league.name}" ${label}?`)) return
    startTransition(async () => {
      const result = await setLeagueStatus(league.id, status)
      if ("error" in result) {
        alert(typeof result.error === "string" ? result.error : "Fehler beim Statuswechsel.")
      }
    })
  }

  function handleDelete() {
    if (!confirm(`Liga „${league.name}" wirklich löschen?`)) return
    startTransition(async () => {
      const result = await deleteLeague(league.id)
      if ("error" in result) {
        alert(typeof result.error === "string" ? result.error : "Fehler beim Löschen.")
      }
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" disabled={isPending}>
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Aktionen</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => router.push(`/leagues/${league.id}/audit-log`)}>
          <ScrollText className="mr-2 h-4 w-4" />
          Protokoll
        </DropdownMenuItem>

        {league.status !== "ARCHIVED" && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push(`/leagues/${league.id}/edit`)}>
              <Pencil className="mr-2 h-4 w-4" />
              Bearbeiten
            </DropdownMenuItem>
          </>
        )}

        {league.status === "ACTIVE" && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => handleStatusChange("COMPLETED", "als abgeschlossen markieren")}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Als abgeschlossen markieren
            </DropdownMenuItem>
          </>
        )}

        {league.status === "COMPLETED" && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleStatusChange("ACTIVE", "wieder öffnen")}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Wieder öffnen
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleStatusChange("ARCHIVED", "archivieren")}>
              <Archive className="mr-2 h-4 w-4" />
              Archivieren
            </DropdownMenuItem>
          </>
        )}

        {league.status === "ARCHIVED" && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() =>
                handleStatusChange("COMPLETED", "wiederherstellen (als abgeschlossen)")
              }
            >
              <ArchiveRestore className="mr-2 h-4 w-4" />
              Wiederherstellen
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleDelete}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Löschen
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

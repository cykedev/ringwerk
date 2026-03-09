"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { MoreHorizontal, Pencil, Archive, ArchiveRestore, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { setDisciplineArchived, deleteDiscipline } from "@/lib/disciplines/actions"
import type { Discipline } from "@/generated/prisma/client"

interface Props {
  discipline: Discipline
}

export function DisciplineActions({ discipline }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleArchive(archive: boolean) {
    startTransition(async () => {
      const result = await setDisciplineArchived(discipline.id, archive)
      if ("error" in result) {
        alert(typeof result.error === "string" ? result.error : "Fehler beim Archivieren.")
      }
    })
  }

  function handleDelete() {
    if (!confirm(`Disziplin „${discipline.name}" wirklich löschen?`)) return
    startTransition(async () => {
      const result = await deleteDiscipline(discipline.id)
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
        {!discipline.isArchived && (
          <DropdownMenuItem onClick={() => router.push(`/disciplines/${discipline.id}/edit`)}>
            <Pencil className="mr-2 h-4 w-4" />
            Bearbeiten
          </DropdownMenuItem>
        )}
        {!discipline.isArchived ? (
          <DropdownMenuItem onClick={() => handleArchive(true)}>
            <Archive className="mr-2 h-4 w-4" />
            Archivieren
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => handleArchive(false)}>
            <ArchiveRestore className="mr-2 h-4 w-4" />
            Wiederherstellen
          </DropdownMenuItem>
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

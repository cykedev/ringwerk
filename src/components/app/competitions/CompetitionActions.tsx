"use client"

import { useState, useTransition } from "react"
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { setCompetitionStatus, deleteCompetition } from "@/lib/competitions/actions"
import type { CompetitionListItem } from "@/lib/competitions/types"
import type { CompetitionStatus } from "@/generated/prisma/client"

interface Props {
  competition: CompetitionListItem
}

interface PendingStatus {
  status: CompetitionStatus
  label: string
}

export function CompetitionActions({ competition }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [pendingStatus, setPendingStatus] = useState<PendingStatus | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)

  function handleStatusChange() {
    if (!pendingStatus) return
    startTransition(async () => {
      const result = await setCompetitionStatus(competition.id, pendingStatus.status)
      if ("error" in result) {
        toast.error(typeof result.error === "string" ? result.error : "Fehler beim Statuswechsel.")
      }
      setPendingStatus(null)
    })
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteCompetition(competition.id)
      if ("error" in result) {
        toast.error(typeof result.error === "string" ? result.error : "Fehler beim Löschen.")
      }
      setDeleteOpen(false)
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" disabled={isPending}>
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Aktionen</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => router.push(`/competitions/${competition.id}/audit-log`)}
          >
            <ScrollText className="mr-2 h-4 w-4" />
            Protokoll
          </DropdownMenuItem>

          {competition.status !== "ARCHIVED" && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push(`/competitions/${competition.id}/edit`)}>
                <Pencil className="mr-2 h-4 w-4" />
                Bearbeiten
              </DropdownMenuItem>
            </>
          )}

          {competition.status === "ACTIVE" && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() =>
                  setPendingStatus({ status: "COMPLETED", label: "als abgeschlossen markieren" })
                }
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Als abgeschlossen markieren
              </DropdownMenuItem>
            </>
          )}

          {competition.status === "COMPLETED" && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setPendingStatus({ status: "ACTIVE", label: "wieder öffnen" })}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Wieder öffnen
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setPendingStatus({ status: "ARCHIVED", label: "archivieren" })}
              >
                <Archive className="mr-2 h-4 w-4" />
                Archivieren
              </DropdownMenuItem>
            </>
          )}

          {competition.status === "ARCHIVED" && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() =>
                  setPendingStatus({
                    status: "COMPLETED",
                    label: "wiederherstellen (als abgeschlossen)",
                  })
                }
              >
                <ArchiveRestore className="mr-2 h-4 w-4" />
                Wiederherstellen
              </DropdownMenuItem>
            </>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setDeleteOpen(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Löschen
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Status-Änderung bestätigen */}
      <AlertDialog open={!!pendingStatus} onOpenChange={(open) => !open && setPendingStatus(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Wettbewerb {pendingStatus?.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              {`Wettbewerb „${competition.name}" wird ${pendingStatus?.label}.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleStatusChange}>Bestätigen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Löschen bestätigen */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Wettbewerb löschen?</AlertDialogTitle>
            <AlertDialogDescription>{`Wettbewerb „${competition.name}" wirklich löschen?`}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

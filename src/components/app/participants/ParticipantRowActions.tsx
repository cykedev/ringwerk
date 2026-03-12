"use client"

import { useState, useTransition } from "react"
import { Pencil, UserCheck, UserX } from "lucide-react"
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"
import { setParticipantActive, updateParticipant } from "@/lib/participants/actions"
import { ParticipantForm } from "./ParticipantForm"

interface Props {
  participantId: string
  firstName: string
  lastName: string
  contact: string
  isActive: boolean
}

export function ParticipantRowActions({
  participantId,
  firstName,
  lastName,
  contact,
  isActive,
}: Props) {
  const [editOpen, setEditOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const action = updateParticipant.bind(null, participantId)

  function handleToggleActive() {
    startTransition(async () => {
      const result = await setParticipantActive(participantId, !isActive)
      if ("error" in result) {
        toast.error(typeof result.error === "string" ? result.error : "Fehler beim Statuswechsel.")
      }
    })
  }

  return (
    <div className="flex items-center gap-1">
      {/* Bearbeiten */}
      <Button
        variant="ghost"
        size="icon"
        className="h-10 w-10"
        title="Bearbeiten"
        onClick={() => setEditOpen(true)}
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Teilnehmer bearbeiten</DialogTitle>
          </DialogHeader>
          <ParticipantForm
            participant={{ firstName, lastName, contact }}
            action={action}
            onSuccess={() => setEditOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Deaktivieren / Aktivieren */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10"
            title={isActive ? "Deaktivieren" : "Aktivieren"}
            disabled={isPending}
          >
            {isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isActive ? "Teilnehmer deaktivieren?" : "Teilnehmer aktivieren?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isActive
                ? `${lastName}, ${firstName} wird deaktiviert und kann keinen Ligen mehr hinzugefügt werden.`
                : `${lastName}, ${firstName} wird wieder aktiviert.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleToggleActive}>
              {isActive ? "Deaktivieren" : "Aktivieren"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

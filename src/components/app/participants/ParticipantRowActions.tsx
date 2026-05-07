"use client"

import { useState, useTransition } from "react"
import { Pencil, Trash2, UserCheck, UserX } from "lucide-react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import {
  setParticipantActive,
  updateParticipant,
  deleteParticipant,
} from "@/lib/participants/actions"
import { ParticipantForm } from "./ParticipantForm"

interface Props {
  participantId: string
  firstName: string
  lastName: string
  contact: string | null
  isActive: boolean
  isAdmin: boolean
  competitionsCount: number
}

export function ParticipantRowActions({
  participantId,
  firstName,
  lastName,
  contact,
  isActive,
  isAdmin,
  competitionsCount,
}: Props) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [confirmName, setConfirmName] = useState("")
  const [isPending, startTransition] = useTransition()

  const action = updateParticipant.bind(null, participantId)
  const hasData = competitionsCount > 0
  const nameMatches = confirmName.trim() === lastName

  function handleToggleActive() {
    startTransition(async () => {
      const result = await setParticipantActive(participantId, !isActive)
      if ("error" in result) {
        toast.error(typeof result.error === "string" ? result.error : "Fehler beim Statuswechsel.")
      }
    })
  }

  function handleDelete(force: boolean) {
    startTransition(async () => {
      const result = await deleteParticipant(participantId, force)
      if ("error" in result) {
        toast.error(typeof result.error === "string" ? result.error : "Fehler beim Löschen.")
      } else {
        setDeleteOpen(false)
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

      {/* Löschen — nur für inaktive Teilnehmer */}
      {!isActive && (
        <AlertDialog
          open={deleteOpen}
          onOpenChange={(open) => {
            setDeleteOpen(open)
            if (!open) setConfirmName("")
          }}
        >
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10"
              title="Löschen"
              disabled={isPending}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>

          {/* Variante 1: Keine Wettbewerbsdaten — einfache Bestätigung */}
          {!hasData && (
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Teilnehmer löschen?</AlertDialogTitle>
                <AlertDialogDescription>
                  {lastName}, {firstName} wird endgültig gelöscht. Diese Aktion kann nicht
                  rückgängig gemacht werden.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isPending}>Abbrechen</AlertDialogCancel>
                <Button
                  variant="destructive"
                  onClick={() => handleDelete(false)}
                  disabled={isPending}
                >
                  {isPending ? "Löschen…" : "Löschen"}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          )}

          {/* Variante 2: Wettbewerbsdaten vorhanden, kein Admin */}
          {hasData && !isAdmin && (
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Löschen nicht möglich</AlertDialogTitle>
                <AlertDialogDescription>
                  Dieser Teilnehmer hat {competitionsCount}{" "}
                  {competitionsCount === 1 ? "Wettbewerb" : "Wettbewerbe"} und kann daher nicht
                  gelöscht werden. Force-Delete ist nur für Admins möglich.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Schließen</AlertDialogCancel>
              </AlertDialogFooter>
            </AlertDialogContent>
          )}

          {/* Variante 3: Wettbewerbsdaten vorhanden, Admin — Force-Delete */}
          {hasData && isAdmin && (
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Teilnehmer endgültig löschen?</AlertDialogTitle>
                <AlertDialogDescription>
                  Diese Aktion kann nicht rückgängig gemacht werden. Alle Daten dieses Teilnehmers
                  werden dauerhaft gelöscht — inklusive {competitionsCount}{" "}
                  {competitionsCount === 1 ? "Wettbewerb" : "Wettbewerbe"}, alle Serien und
                  Liga-Paarungen (inkl. der Serien des jeweiligen Gegners).
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-2">
                <Label htmlFor="confirm-participant-name">
                  Zur Bestätigung den Nachnamen eingeben:{" "}
                  <span className="font-semibold">{lastName}</span>
                </Label>
                <Input
                  id="confirm-participant-name"
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                  placeholder={lastName}
                  disabled={isPending}
                  autoComplete="off"
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isPending}>Abbrechen</AlertDialogCancel>
                <Button
                  variant="destructive"
                  onClick={() => handleDelete(true)}
                  disabled={!nameMatches || isPending}
                >
                  {isPending ? "Löschen…" : "Endgültig löschen"}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          )}
        </AlertDialog>
      )}
    </div>
  )
}

"use client"

import { useState, useTransition } from "react"
import { UserMinus, UserCheck, Trash2, Pencil } from "lucide-react"
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import {
  withdrawParticipant,
  revokeWithdrawal,
  unenrollParticipant,
  updateParticipantDiscipline,
} from "@/lib/competitionParticipants/actions"
import type { CompetitionParticipantListItem } from "@/lib/competitionParticipants/types"
import type { SerializableDiscipline } from "@/lib/disciplines/types"

interface Props {
  entry: CompetitionParticipantListItem
  playoffsStarted: boolean
  /** Übergeben bei gemischten Wettbewerben — ermöglicht Disziplin-Edit */
  disciplines?: SerializableDiscipline[]
}

export function CompetitionParticipantActions({ entry, playoffsStarted, disciplines }: Props) {
  const [isPending, startTransition] = useTransition()
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [disciplineOpen, setDisciplineOpen] = useState(false)
  const [selectedDisciplineId, setSelectedDisciplineId] = useState<string>(entry.disciplineId ?? "")

  const fullName = entry.isGuest
    ? entry.participant.firstName
    : `${entry.participant.lastName}, ${entry.participant.firstName}`

  // Disziplin-Edit möglich wenn: gemischter WB, aktiv, keine Serien, kein Gast
  const canEditDiscipline =
    disciplines &&
    disciplines.length > 0 &&
    !entry.isGuest &&
    entry.status === "ACTIVE" &&
    entry.seriesCount === 0

  if (playoffsStarted) return null

  function handleWithdraw() {
    startTransition(async () => {
      const fd = new FormData()
      fd.append("reason", reason)
      const result = await withdrawParticipant(entry.id, null, fd)
      if ("error" in result) {
        toast.error(typeof result.error === "string" ? result.error : "Fehler beim Rückzug.")
      } else {
        setWithdrawOpen(false)
        setReason("")
      }
    })
  }

  function handleRevokeWithdrawal() {
    startTransition(async () => {
      const result = await revokeWithdrawal(entry.id)
      if ("error" in result) {
        toast.error(
          typeof result.error === "string" ? result.error : "Fehler beim Rückgängigmachen."
        )
      }
    })
  }

  function handleUnenroll() {
    startTransition(async () => {
      const result = await unenrollParticipant(entry.id)
      if ("error" in result) {
        toast.error(typeof result.error === "string" ? result.error : "Fehler beim Entfernen.")
      }
    })
  }

  function handleDisciplineSave() {
    if (!selectedDisciplineId) return
    startTransition(async () => {
      const result = await updateParticipantDiscipline(entry.id, selectedDisciplineId)
      if ("error" in result) {
        toast.error(
          typeof result.error === "string" ? result.error : "Fehler beim Ändern der Disziplin."
        )
      } else {
        setDisciplineOpen(false)
      }
    })
  }

  return (
    <div className="flex items-center gap-1">
      {/* Disziplin ändern */}
      {canEditDiscipline && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10"
            title="Disziplin ändern"
            onClick={() => {
              setSelectedDisciplineId(entry.disciplineId ?? "")
              setDisciplineOpen(true)
            }}
            disabled={isPending}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Dialog open={disciplineOpen} onOpenChange={setDisciplineOpen}>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Disziplin ändern</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">{fullName}</p>
              <div className="space-y-1.5">
                <Label htmlFor="discipline-select">Disziplin</Label>
                <Select
                  value={selectedDisciplineId}
                  onValueChange={setSelectedDisciplineId}
                  disabled={isPending}
                >
                  <SelectTrigger id="discipline-select">
                    <SelectValue placeholder="Disziplin wählen…" />
                  </SelectTrigger>
                  <SelectContent>
                    {disciplines!.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setDisciplineOpen(false)}
                  disabled={isPending}
                >
                  Abbrechen
                </Button>
                <Button
                  onClick={handleDisciplineSave}
                  disabled={isPending || !selectedDisciplineId}
                >
                  {isPending ? "Speichern…" : "Speichern"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}

      {/* Zurückziehen */}
      {entry.status === "ACTIVE" && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10"
            title="Zurückziehen"
            onClick={() => setWithdrawOpen(true)}
            disabled={isPending}
          >
            <UserMinus className="h-4 w-4" />
          </Button>
          <Dialog
            open={withdrawOpen}
            onOpenChange={(open) => {
              setWithdrawOpen(open)
              if (!open) setReason("")
            }}
          >
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Teilnehmer zurückziehen?</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                {fullName} wird zurückgezogen. Alle Ergebnisse werden aus der Wertung genommen.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="withdraw-reason">
                  Begründung <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="withdraw-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="z.B. verletzt"
                  disabled={isPending}
                />
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setWithdrawOpen(false)}
                  disabled={isPending}
                >
                  Abbrechen
                </Button>
                <Button variant="destructive" onClick={handleWithdraw} disabled={isPending}>
                  {isPending ? "Zurückziehen…" : "Zurückziehen"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}

      {/* Rückzug rückgängig */}
      {entry.status === "WITHDRAWN" && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10"
              title="Rückzug rückgängig"
              disabled={isPending}
            >
              <UserCheck className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Rückzug rückgängig machen?</AlertDialogTitle>
              <AlertDialogDescription>
                {fullName} wird wieder als aktiv eingeschrieben.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
              <AlertDialogAction onClick={handleRevokeWithdrawal}>
                Rückgängig machen
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Aus Wettbewerb entfernen */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 text-destructive/70 hover:text-destructive"
            title="Aus Wettbewerb entfernen"
            disabled={isPending}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aus Wettbewerb entfernen?</AlertDialogTitle>
            <AlertDialogDescription>
              {fullName} wird dauerhaft aus diesem Wettbewerb entfernt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnenroll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Entfernen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

"use client"

import { useState, useActionState } from "react"
import { Pencil, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { saveEventSeries } from "@/lib/series/actions"
import type { ActionResult } from "@/lib/types"

interface Props {
  competitionId: string
  competitionParticipantId: string
  participantName: string
  /** Vorhandene Serie — wenn gesetzt, Korrektur-Modus */
  existingSeries?: { rings: number; teiler: number }
}

export function EventSeriesDialog({
  competitionId,
  competitionParticipantId,
  participantName,
  existingSeries,
}: Props) {
  const [open, setOpen] = useState(false)
  const isCorrection = !!existingSeries

  const boundAction = saveEventSeries.bind(null, competitionId, competitionParticipantId)
  const [state, formAction, isPending] = useActionState(
    (prev: ActionResult | null, formData: FormData) => boundAction(prev, formData),
    null
  )

  const fieldErrors =
    state && "error" in state && typeof state.error === "object" ? state.error : null
  const generalError =
    state && "error" in state && typeof state.error === "string" ? state.error : null

  // Dialog nach Erfolg schließen
  if (state && "success" in state && state.success && open) {
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10"
          title={isCorrection ? "Ergebnis korrigieren" : "Ergebnis eintragen"}
        >
          {isCorrection ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isCorrection ? "Ergebnis korrigieren" : "Ergebnis eintragen"}</DialogTitle>
          <p className="text-sm text-muted-foreground">{participantName}</p>
        </DialogHeader>

        <form id="series-form" action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rings">Gesamtringe</Label>
            <Input
              id="rings"
              name="rings"
              type="text"
              inputMode="decimal"
              defaultValue={existingSeries?.rings ?? ""}
              placeholder="z.B. 96"
              disabled={isPending}
              autoFocus
            />
            {fieldErrors?.rings && (
              <p className="text-sm text-destructive">{fieldErrors.rings[0]}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="teiler">Bester Teiler</Label>
            <Input
              id="teiler"
              name="teiler"
              type="text"
              inputMode="decimal"
              defaultValue={existingSeries?.teiler ?? ""}
              placeholder="z.B. 3.7"
              disabled={isPending}
            />
            {fieldErrors?.teiler && (
              <p className="text-sm text-destructive">{fieldErrors.teiler[0]}</p>
            )}
          </div>

          {generalError && <p className="text-sm text-destructive">{generalError}</p>}
        </form>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
            Abbrechen
          </Button>
          <Button type="submit" form="series-form" disabled={isPending}>
            {isPending ? "Speichern…" : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

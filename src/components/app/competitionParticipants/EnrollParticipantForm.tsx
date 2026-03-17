"use client"

import { useActionState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { ParticipantOption } from "@/lib/participants/types"
import type { ActionResult } from "@/lib/types"

interface Props {
  competitionId: string
  availableParticipants: ParticipantOption[]
  action: (prevState: ActionResult | null, formData: FormData) => Promise<ActionResult>
}

export function EnrollParticipantForm({ availableParticipants, action }: Props) {
  const [state, formAction, isPending] = useActionState(action, null)

  useEffect(() => {
    if (state && "success" in state && state.success) {
      // Seite wird durch revalidatePath neu geladen — kein Router-Push nötig
    }
  }, [state])

  const fieldErrors =
    state && "error" in state && typeof state.error === "object" ? state.error : null
  const generalError =
    state && "error" in state && typeof state.error === "string" ? state.error : null

  if (availableParticipants.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Alle aktiven Teilnehmer sind bereits in diesem Wettbewerb eingeschrieben.
      </p>
    )
  }

  return (
    <form action={formAction} className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1 flex flex-col gap-1">
          <Label htmlFor="participantId" className="sm:sr-only">
            Teilnehmer
          </Label>
          <Select name="participantId" disabled={isPending}>
            <SelectTrigger id="participantId" className="w-full">
              <SelectValue placeholder="Teilnehmer wählen…" />
            </SelectTrigger>
            <SelectContent>
              {availableParticipants.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.lastName}, {p.firstName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fieldErrors?.participantId && (
            <p className="text-xs text-destructive">{fieldErrors.participantId[0]}</p>
          )}
        </div>

        <Button type="submit" disabled={isPending} className="w-full sm:w-auto sm:shrink-0">
          {isPending ? "Lädt…" : "Einschreiben"}
        </Button>
      </div>

      {generalError && <p className="text-sm text-destructive">{generalError}</p>}
    </form>
  )
}

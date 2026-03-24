"use client"

import { useActionState, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { ParticipantOption } from "@/lib/participants/types"
import type { SerializableDiscipline } from "@/lib/disciplines/types"
import type { ActionResult } from "@/lib/types"

interface Props {
  competitionId: string
  availableParticipants: ParticipantOption[]
  /** Wenn gesetzt: gemischter Wettbewerb — Disziplinwahl pro Teilnehmer erforderlich */
  disciplines?: SerializableDiscipline[]
  /** Wenn true: Gast-Einschreibung erlaubt (allowGuests auf Event) */
  allowGuests?: boolean
  action: (prevState: ActionResult | null, formData: FormData) => Promise<ActionResult>
}

export function EnrollParticipantForm({
  availableParticipants,
  disciplines,
  allowGuests,
  action,
}: Props) {
  const [state, formAction, isPending] = useActionState(action, null)
  const [isGuest, setIsGuest] = useState(false)

  const isMixed = disciplines && disciplines.length > 0

  useEffect(() => {
    if (state && "success" in state && state.success) {
      // Seite wird durch revalidatePath neu geladen — kein Router-Push nötig
    }
  }, [state])

  const fieldErrors =
    state && "error" in state && typeof state.error === "object" ? state.error : null
  const generalError =
    state && "error" in state && typeof state.error === "string" ? state.error : null

  const noRegularParticipants = availableParticipants.length === 0

  // Formular nur ausblenden wenn keine Teilnehmer verfügbar UND keine Gäste erlaubt
  if (noRegularParticipants && !allowGuests) {
    return (
      <p className="text-sm text-muted-foreground">
        Alle aktiven Teilnehmer sind bereits in diesem Wettbewerb eingeschrieben.
      </p>
    )
  }

  return (
    <form action={formAction} className="space-y-3">
      {allowGuests && (
        <div className="flex items-center gap-2">
          <Checkbox
            id="isGuest"
            checked={isGuest}
            onCheckedChange={(checked: boolean | "indeterminate") => setIsGuest(checked === true)}
            disabled={isPending}
          />
          <Label htmlFor="isGuest" className="cursor-pointer text-sm">
            Gast-Schütze
          </Label>
          <input type="hidden" name="isGuest" value={isGuest ? "true" : "false"} />
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        {isGuest ? (
          <div className="flex-1 flex flex-col gap-2">
            <Label htmlFor="guestName" className="sm:sr-only">
              Name des Gastes
            </Label>
            <Input
              id="guestName"
              name="guestName"
              placeholder="Name des Gastes…"
              disabled={isPending}
              autoComplete="off"
            />
            {fieldErrors?.guestName && (
              <p className="text-xs text-destructive">{fieldErrors.guestName[0]}</p>
            )}
          </div>
        ) : (
          <>
            {noRegularParticipants ? (
              <p className="flex-1 text-sm text-muted-foreground self-center">
                Alle aktiven Teilnehmer sind bereits eingeschrieben.
              </p>
            ) : (
              <div className="flex-1 flex flex-col gap-2">
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
            )}
          </>
        )}

        {isMixed && (
          <div className="flex-1 flex flex-col gap-1">
            <Label htmlFor="disciplineId" className="sm:sr-only">
              Disziplin
            </Label>
            <Select name="disciplineId" disabled={isPending}>
              <SelectTrigger id="disciplineId" className="w-full">
                <SelectValue placeholder="Disziplin wählen…" />
              </SelectTrigger>
              <SelectContent>
                {disciplines.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors?.disciplineId && (
              <p className="text-xs text-destructive">{fieldErrors.disciplineId[0]}</p>
            )}
          </div>
        )}

        {(isGuest || !noRegularParticipants) && (
          <Button type="submit" disabled={isPending} className="w-full sm:w-auto sm:shrink-0">
            {isPending ? "Lädt…" : "Einschreiben"}
          </Button>
        )}
      </div>

      {generalError && <p className="text-sm text-destructive">{generalError}</p>}
    </form>
  )
}

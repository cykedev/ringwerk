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
import type { EventTeamItem } from "@/lib/eventTeams/types"
import type { ActionResult } from "@/lib/types"

interface Props {
  competitionId: string
  availableParticipants: ParticipantOption[]
  /** Wenn gesetzt: gemischter Wettbewerb — Disziplinwahl pro Teilnehmer erforderlich */
  disciplines?: SerializableDiscipline[]
  /** Wenn true: Gast-Einschreibung erlaubt (allowGuests auf Event) */
  allowGuests?: boolean
  /** Team-Events: Teamgröße ≥ 2 */
  teamSize?: number | null
  /** Team-Events: bestehende Teams mit ihren Mitgliedern */
  eventTeams?: EventTeamItem[]
  action: (prevState: ActionResult | null, formData: FormData) => Promise<ActionResult>
}

export function EnrollParticipantForm({
  availableParticipants,
  disciplines,
  allowGuests,
  teamSize,
  eventTeams,
  action,
}: Props) {
  const [state, formAction, isPending] = useActionState(action, null)
  const [isGuest, setIsGuest] = useState(false)
  const [newTeam, setNewTeam] = useState(false)

  const isMixed = disciplines && disciplines.length > 0
  const isTeamEvent = (teamSize ?? 0) >= 2

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

  // Im Team-Modus können Teilnehmer mehrfach eingeschrieben werden — kein "alle bereits eingeschrieben"
  if (noRegularParticipants && !allowGuests && !isTeamEvent) {
    return (
      <p className="text-sm text-muted-foreground">
        Alle aktiven Teilnehmer sind bereits in diesem Wettbewerb eingeschrieben.
      </p>
    )
  }

  const incompleteTeams = (eventTeams ?? []).filter((t) => t.members.length < (teamSize ?? 0))

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

        {(isGuest || !noRegularParticipants) && !isTeamEvent && (
          <Button type="submit" disabled={isPending} className="w-full sm:w-auto sm:shrink-0">
            {isPending ? "Lädt…" : "Einschreiben"}
          </Button>
        )}
      </div>

      {/* Team-Auswahl */}
      {isTeamEvent && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="newTeam"
              checked={newTeam}
              onCheckedChange={(checked: boolean | "indeterminate") => setNewTeam(checked === true)}
              disabled={isPending}
            />
            <Label htmlFor="newTeam" className="cursor-pointer text-sm">
              Neues Team erstellen
            </Label>
            <input type="hidden" name="newTeam" value={newTeam ? "true" : "false"} />
          </div>

          {!newTeam && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="teamId" className="text-sm">
                Team wählen
              </Label>
              <Select name="teamId" disabled={isPending}>
                <SelectTrigger id="teamId" className="w-full">
                  <SelectValue placeholder="Team wählen…" />
                </SelectTrigger>
                <SelectContent>
                  {incompleteTeams.length === 0 ? (
                    <SelectItem value="_none" disabled>
                      Keine unvollständigen Teams vorhanden
                    </SelectItem>
                  ) : (
                    incompleteTeams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        Team {t.teamNumber} ({t.members.length}/{teamSize})
                        {t.members.length > 0 &&
                          ` — ${t.members.map((m) => m.firstName).join(", ")}`}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {fieldErrors?.teamId && (
                <p className="text-xs text-destructive">{fieldErrors.teamId[0]}</p>
              )}
            </div>
          )}

          <Button
            type="submit"
            disabled={isPending || (!newTeam && incompleteTeams.length === 0)}
            className="w-full sm:w-auto"
          >
            {isPending ? "Lädt…" : "Einschreiben"}
          </Button>
        </div>
      )}

      {generalError && <p className="text-sm text-destructive">{generalError}</p>}
    </form>
  )
}

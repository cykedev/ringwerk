"use client"

import { useState, useActionState, useEffect } from "react"
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
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RingsInput } from "@/components/app/series/RingsInput"
import { saveSeasonSeries, updateSeasonSeries } from "@/lib/series/actions"
import { getEffectiveScoringType } from "@/lib/series/scoring-format"
import type { ActionResult } from "@/lib/types"
import type { ScoringMode, ScoringType } from "@/generated/prisma/client"
import { Input } from "@/components/ui/input"

interface ExistingSeries {
  id: string
  rings: number
  teiler: number
  /** ISO-Datum (YYYY-MM-DD) */
  sessionDate: string
  disciplineId?: string | null
}

interface Props {
  competitionId: string
  participantId: string
  participantName: string
  scoringMode: ScoringMode
  shotsPerSeries: number
  /** Disziplinen für gemischte Saisons */
  disciplines?: { id: string; name: string; scoringType: ScoringType }[]
  defaultDisciplineId?: string | null
  /** Wenn gesetzt: Edit-Modus für diese bestehende Serie */
  existingSeries?: ExistingSeries
}

export function SeasonSeriesDialog({
  competitionId,
  participantId,
  participantName,
  scoringMode,
  shotsPerSeries,
  disciplines,
  defaultDisciplineId,
  existingSeries,
}: Props) {
  const [open, setOpen] = useState(false)
  const isMixed = disciplines && disciplines.length > 0
  const isCorrection = !!existingSeries

  const initialDisciplineId =
    existingSeries?.disciplineId ?? defaultDisciplineId ?? disciplines?.[0]?.id ?? null
  const [selectedDisciplineId, setSelectedDisciplineId] = useState<string | null>(
    initialDisciplineId
  )

  const [sessionDate, setSessionDate] = useState<string>(
    existingSeries?.sessionDate ?? new Date().toISOString().slice(0, 10)
  )
  const [rings, setRings] = useState<string>(existingSeries ? String(existingSeries.rings) : "")
  const [teiler, setTeiler] = useState<string>(existingSeries ? String(existingSeries.teiler) : "")

  // Compute effective scoring type based on currently selected discipline
  const selectedDiscipline = disciplines?.find((d) => d.id === selectedDisciplineId) ?? null
  const effectiveScoringType = getEffectiveScoringType(scoringMode, selectedDiscipline)

  const boundAction = isCorrection
    ? updateSeasonSeries.bind(null, competitionId, existingSeries.id)
    : saveSeasonSeries.bind(null, competitionId, participantId)

  const [state, formAction, isPending] = useActionState(
    (prev: ActionResult | null, formData: FormData) => boundAction(prev, formData),
    null
  )

  const fieldErrors =
    state && "error" in state && typeof state.error === "object" ? state.error : null
  const generalError =
    state && "error" in state && typeof state.error === "string" ? state.error : null

  useEffect(() => {
    if (state && "success" in state && state.success) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(false)
    }
  }, [state])

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) {
      setSessionDate(existingSeries?.sessionDate ?? new Date().toISOString().slice(0, 10))
      setRings(existingSeries ? String(existingSeries.rings) : "")
      setTeiler(existingSeries ? String(existingSeries.teiler) : "")
      setSelectedDisciplineId(initialDisciplineId)
    }
    setOpen(isOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {isCorrection ? (
          <Button variant="ghost" size="icon" className="h-10 w-10" title="Serie bearbeiten">
            <Pencil className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="ghost" size="icon" className="h-10 w-10" title="Serie hinzufügen">
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isCorrection ? "Serie bearbeiten" : "Serie hinzufügen"}</DialogTitle>
          <p className="text-sm text-muted-foreground">{participantName}</p>
        </DialogHeader>

        <form id="season-series-form" action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sessionDate">Datum</Label>
            <Input
              id="sessionDate"
              name="sessionDate"
              type="date"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              disabled={isPending}
              autoFocus
            />
            {fieldErrors?.sessionDate && (
              <p className="text-sm text-destructive">{fieldErrors.sessionDate[0]}</p>
            )}
          </div>

          {isMixed && disciplines && (
            <div className="space-y-2">
              <Label htmlFor="disciplineId">Disziplin</Label>
              <Select
                name="disciplineId"
                value={selectedDisciplineId ?? undefined}
                onValueChange={setSelectedDisciplineId}
                disabled={isPending}
              >
                <SelectTrigger id="disciplineId">
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
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="rings">Gesamtringe</Label>
            <RingsInput
              id="rings"
              name="rings"
              scoringType={effectiveScoringType}
              shotsPerSeries={shotsPerSeries}
              value={rings}
              onChange={(e) => setRings(e.target.value)}
              disabled={isPending}
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
              placeholder="z.B. 3,7"
              value={teiler}
              onChange={(e) => setTeiler(e.target.value)}
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
          <Button type="submit" form="season-series-form" disabled={isPending}>
            {isPending ? "Speichern…" : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

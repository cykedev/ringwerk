"use client"

import { useState, useTransition } from "react"
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
import { saveMatchResult } from "@/lib/results/actions"
import type { MatchResultSummary } from "@/lib/matchups/types"

interface ParticipantResult {
  totalRings: string
  teiler: string
}

interface Props {
  matchupId: string
  homeName: string
  awayName: string
  homeParticipantId: string
  awayParticipantId: string
  /** Existierende Ergebnisse für Vorausfüllung bei Korrektur */
  existingResults: MatchResultSummary[]
  isCorrection: boolean
}

function getExisting(
  results: MatchResultSummary[],
  participantId: string
): MatchResultSummary | undefined {
  return results.find((r) => r.participantId === participantId)
}

export function ResultEntryDialog({
  matchupId,
  homeName,
  awayName,
  homeParticipantId,
  awayParticipantId,
  existingResults,
  isCorrection,
}: Props) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const existingHome = getExisting(existingResults, homeParticipantId)
  const existingAway = getExisting(existingResults, awayParticipantId)

  const [home, setHome] = useState<ParticipantResult>({
    totalRings: existingHome ? String(existingHome.totalRings) : "",
    teiler: existingHome ? String(existingHome.teiler) : "",
  })
  const [away, setAway] = useState<ParticipantResult>({
    totalRings: existingAway ? String(existingAway.totalRings) : "",
    teiler: existingAway ? String(existingAway.teiler) : "",
  })

  function handleOpen(isOpen: boolean) {
    if (isOpen) {
      // Beim Öffnen: existierende Werte neu laden
      setHome({
        totalRings: existingHome ? String(existingHome.totalRings) : "",
        teiler: existingHome ? String(existingHome.teiler) : "",
      })
      setAway({
        totalRings: existingAway ? String(existingAway.totalRings) : "",
        teiler: existingAway ? String(existingAway.teiler) : "",
      })
      setError(null)
    }
    setOpen(isOpen)
  }

  function handleSubmit() {
    const homeTotalRings = parseFloat(home.totalRings.replace(",", "."))
    const homeTeiler = parseFloat(home.teiler.replace(",", "."))
    const awayTotalRings = parseFloat(away.totalRings.replace(",", "."))
    const awayTeiler = parseFloat(away.teiler.replace(",", "."))

    if (isNaN(homeTotalRings) || isNaN(homeTeiler) || isNaN(awayTotalRings) || isNaN(awayTeiler)) {
      setError("Alle Felder müssen ausgefüllt sein.")
      return
    }

    if (homeTotalRings < 0 || awayTotalRings < 0) {
      setError("Gesamtringe müssen positiv sein.")
      return
    }

    if (homeTeiler < 0 || awayTeiler < 0) {
      setError("Teiler müssen positiv sein.")
      return
    }

    setError(null)

    startTransition(async () => {
      const result = await saveMatchResult(matchupId, {
        homeResult: { totalRings: homeTotalRings, teiler: homeTeiler },
        awayResult: { totalRings: awayTotalRings, teiler: awayTeiler },
      })

      if ("error" in result) {
        setError(typeof result.error === "string" ? result.error : "Fehler beim Speichern.")
      } else {
        setOpen(false)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        {isCorrection ? (
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
            <Pencil className="mr-1 h-3 w-3" />
            Korrigieren
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs">
            <Plus className="mr-1 h-3 w-3" />
            Eintragen
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isCorrection ? "Ergebnis korrigieren" : "Ergebnis eintragen"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Heim */}
          <div className="space-y-2">
            <p className="text-sm font-medium">{homeName}</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="home-rings" className="text-xs text-muted-foreground">
                  Gesamtringe
                </Label>
                <Input
                  id="home-rings"
                  type="number"
                  step="0.1"
                  min="0"
                  value={home.totalRings}
                  onChange={(e) => setHome((p) => ({ ...p, totalRings: e.target.value }))}
                  placeholder="z.B. 96"
                  disabled={isPending}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="home-teiler" className="text-xs text-muted-foreground">
                  Bester Teiler
                </Label>
                <Input
                  id="home-teiler"
                  type="number"
                  step="0.1"
                  min="0"
                  value={home.teiler}
                  onChange={(e) => setHome((p) => ({ ...p, teiler: e.target.value }))}
                  placeholder="z.B. 3.7"
                  disabled={isPending}
                />
              </div>
            </div>
          </div>

          {/* Trennlinie */}
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">vs.</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Gast */}
          <div className="space-y-2">
            <p className="text-sm font-medium">{awayName}</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="away-rings" className="text-xs text-muted-foreground">
                  Gesamtringe
                </Label>
                <Input
                  id="away-rings"
                  type="number"
                  step="0.1"
                  min="0"
                  value={away.totalRings}
                  onChange={(e) => setAway((p) => ({ ...p, totalRings: e.target.value }))}
                  placeholder="z.B. 94"
                  disabled={isPending}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="away-teiler" className="text-xs text-muted-foreground">
                  Bester Teiler
                </Label>
                <Input
                  id="away-teiler"
                  type="number"
                  step="0.1"
                  min="0"
                  value={away.teiler}
                  onChange={(e) => setAway((p) => ({ ...p, teiler: e.target.value }))}
                  placeholder="z.B. 5.0"
                  disabled={isPending}
                />
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Abbrechen
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Speichern…" : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

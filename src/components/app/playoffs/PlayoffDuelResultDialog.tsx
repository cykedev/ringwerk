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
import { savePlayoffDuelResult } from "@/lib/playoffs/actions"
import type { PlayoffDuelItem, PlayoffParticipant } from "@/lib/playoffs/types"

interface Props {
  duel: PlayoffDuelItem
  participantA: PlayoffParticipant
  participantB: PlayoffParticipant
  isCorrection: boolean
  isFinalMatch: boolean
}

interface ResultFields {
  totalRings: string
  teiler: string
}

export function PlayoffDuelResultDialog({
  duel,
  participantA,
  participantB,
  isCorrection,
  isFinalMatch,
}: Props) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [fieldA, setFieldA] = useState<ResultFields>({
    totalRings: duel.resultA ? String(duel.resultA.totalRings) : "",
    teiler: duel.resultA?.teiler != null ? String(duel.resultA.teiler) : "",
  })
  const [fieldB, setFieldB] = useState<ResultFields>({
    totalRings: duel.resultB ? String(duel.resultB.totalRings) : "",
    teiler: duel.resultB?.teiler != null ? String(duel.resultB.teiler) : "",
  })

  function handleOpen(isOpen: boolean) {
    if (isOpen) {
      setFieldA({
        totalRings: duel.resultA ? String(duel.resultA.totalRings) : "",
        teiler: duel.resultA?.teiler != null ? String(duel.resultA.teiler) : "",
      })
      setFieldB({
        totalRings: duel.resultB ? String(duel.resultB.totalRings) : "",
        teiler: duel.resultB?.teiler != null ? String(duel.resultB.teiler) : "",
      })
      setError(null)
    }
    setOpen(isOpen)
  }

  function handleSubmit() {
    const totalRingsA = parseFloat(fieldA.totalRings.replace(",", "."))
    const totalRingsB = parseFloat(fieldB.totalRings.replace(",", "."))

    if (isNaN(totalRingsA) || isNaN(totalRingsB)) {
      setError("Gesamtringe müssen ausgefüllt sein.")
      return
    }
    if (totalRingsA < 0 || totalRingsB < 0) {
      setError("Gesamtringe müssen positiv sein.")
      return
    }

    let teilerA: number | undefined
    let teilerB: number | undefined

    if (!isFinalMatch) {
      teilerA = parseFloat(fieldA.teiler.replace(",", "."))
      teilerB = parseFloat(fieldB.teiler.replace(",", "."))
      if (isNaN(teilerA) || isNaN(teilerB)) {
        setError("Teiler müssen ausgefüllt sein.")
        return
      }
      if (teilerA < 0 || teilerB < 0) {
        setError("Teiler müssen positiv sein.")
        return
      }
    }

    setError(null)

    startTransition(async () => {
      const result = await savePlayoffDuelResult({
        duelId: duel.id,
        totalRingsA,
        teilerA,
        totalRingsB,
        teilerB,
      })

      if ("error" in result) {
        setError(typeof result.error === "string" ? result.error : "Fehler beim Speichern.")
      } else {
        setOpen(false)
      }
    })
  }

  const title = isFinalMatch
    ? duel.isSuddenDeath
      ? "Verlängerung eintragen"
      : isCorrection
        ? "10 Schüsse korrigieren"
        : "10 Schüsse eintragen"
    : duel.isSuddenDeath
      ? "Entscheidungsduell eintragen"
      : isCorrection
        ? `Duell ${duel.duelNumber} korrigieren`
        : `Duell ${duel.duelNumber} eintragen`

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        {isCorrection ? (
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
            <Pencil className="h-3 w-3" />
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
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Teilnehmer A */}
          <div className="space-y-2">
            <p className="text-sm font-medium">
              {participantA.firstName} {participantA.lastName}
            </p>
            <div className={isFinalMatch ? "max-w-[160px]" : "grid grid-cols-2 gap-3"}>
              <div className="space-y-1">
                <Label htmlFor="a-rings" className="text-xs text-muted-foreground">
                  Gesamtringe
                </Label>
                <Input
                  id="a-rings"
                  type="number"
                  step="0.1"
                  min="0"
                  value={fieldA.totalRings}
                  onChange={(e) => setFieldA((p) => ({ ...p, totalRings: e.target.value }))}
                  placeholder="z.B. 96"
                  disabled={isPending}
                />
              </div>
              {!isFinalMatch && (
                <div className="space-y-1">
                  <Label htmlFor="a-teiler" className="text-xs text-muted-foreground">
                    Bester Teiler
                  </Label>
                  <Input
                    id="a-teiler"
                    type="number"
                    step="0.1"
                    min="0"
                    value={fieldA.teiler}
                    onChange={(e) => setFieldA((p) => ({ ...p, teiler: e.target.value }))}
                    placeholder="z.B. 3.7"
                    disabled={isPending}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">vs.</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Teilnehmer B */}
          <div className="space-y-2">
            <p className="text-sm font-medium">
              {participantB.firstName} {participantB.lastName}
            </p>
            <div className={isFinalMatch ? "max-w-[160px]" : "grid grid-cols-2 gap-3"}>
              <div className="space-y-1">
                <Label htmlFor="b-rings" className="text-xs text-muted-foreground">
                  Gesamtringe
                </Label>
                <Input
                  id="b-rings"
                  type="number"
                  step="0.1"
                  min="0"
                  value={fieldB.totalRings}
                  onChange={(e) => setFieldB((p) => ({ ...p, totalRings: e.target.value }))}
                  placeholder="z.B. 94"
                  disabled={isPending}
                />
              </div>
              {!isFinalMatch && (
                <div className="space-y-1">
                  <Label htmlFor="b-teiler" className="text-xs text-muted-foreground">
                    Bester Teiler
                  </Label>
                  <Input
                    id="b-teiler"
                    type="number"
                    step="0.1"
                    min="0"
                    value={fieldB.teiler}
                    onChange={(e) => setFieldB((p) => ({ ...p, teiler: e.target.value }))}
                    placeholder="z.B. 5.0"
                    disabled={isPending}
                  />
                </div>
              )}
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

"use client"

import { useState, useTransition } from "react"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RingsInput } from "@/components/app/series/RingsInput"
import {
  saveBestOfDuel,
  saveStechschuss,
  deleteLatestBestOfDuel,
} from "@/lib/results/bestOfActions"
import {
  bestOfDuelTally,
  duelOutcome,
  resolveBestOf,
  stechschussOutcome,
} from "@/lib/scoring/bestOf"
import { effectiveTeilerFaktor } from "@/lib/scoring/calculateScore"
import { formatRings, formatDecimal1 } from "@/lib/series/scoring-format"
import type { DuelSeries, BestOfStatus } from "@/lib/scoring/bestOf"
import type { MatchResultSummary, MatchupParticipant } from "@/lib/matchups/types"
import type { ScoringMode, ScoringType } from "@/generated/prisma/client"

// ─── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  matchupId: string
  homeParticipant: MatchupParticipant
  awayParticipant: MatchupParticipant
  series: MatchResultSummary[]
  canManage: boolean
  /** True when at least one duel has been recorded (shows edit icon instead of plus). */
  hasResults: boolean
  // Competition best-of config
  scoringMode: ScoringMode
  /** null = mixed (per-participant discipline applies) */
  disciplineId: string | null
  groupBestOf: number
  groupPlayAllDuels: boolean
  groupTiebreaker1: ScoringMode | null
  groupTiebreaker2: ScoringMode | null
  shotsPerSeries: number
  scoringType: ScoringType
  teilerFaktor: number
}

// ─── Helpers (mirrored from BestOfMatchCard) ──────────────────────────────────

/** Group series by duelNumber into DuelSeries pairs for client-side resolveBestOf. */
function deriveMatchStatus(
  homeId: string,
  awayId: string,
  series: MatchResultSummary[],
  disciplineId: string | null,
  scoringMode: ScoringMode,
  tiebreaker1: ScoringMode | null,
  tiebreaker2: ScoringMode | null,
  bestOf: number,
  playAll: boolean
): BestOfStatus {
  const regularByDuel = new Map<number, { home?: DuelSeries; away?: DuelSeries }>()
  const tiebreakByDuel = new Map<number, { homeRings?: number; awayRings?: number }>()

  for (const s of series) {
    if (s.duelNumber === null) continue
    if (s.isTiebreak) {
      const existing = tiebreakByDuel.get(s.duelNumber) ?? {}
      if (s.participantId === homeId) {
        tiebreakByDuel.set(s.duelNumber, { ...existing, homeRings: s.rings })
      } else if (s.participantId === awayId) {
        tiebreakByDuel.set(s.duelNumber, { ...existing, awayRings: s.rings })
      }
    } else {
      // Factor of 1 used here: both sides share the same factor, so outcomes
      // are comparable even without the per-discipline factor for display.
      const factor = effectiveTeilerFaktor(disciplineId, 1)
      const entry: DuelSeries = {
        rings: s.rings,
        correctedTeiler: s.teiler * factor,
        ringteiler: s.ringteiler,
      }
      const existing = regularByDuel.get(s.duelNumber) ?? {}
      if (s.participantId === homeId) {
        regularByDuel.set(s.duelNumber, { ...existing, home: entry })
      } else if (s.participantId === awayId) {
        regularByDuel.set(s.duelNumber, { ...existing, away: entry })
      }
    }
  }

  const regularOutcomes = Array.from(regularByDuel.entries())
    .filter(([, pair]) => pair.home && pair.away)
    .sort(([a], [b]) => a - b)
    .map(([, pair]) => duelOutcome(pair.home!, pair.away!, scoringMode, tiebreaker1, tiebreaker2))

  const tiebreakOutcomes = Array.from(tiebreakByDuel.entries())
    .filter(([, pair]) => pair.homeRings !== undefined && pair.awayRings !== undefined)
    .sort(([a], [b]) => a - b)
    .map(([, pair]) => stechschussOutcome(pair.homeRings!, pair.awayRings!))

  return resolveBestOf(regularOutcomes, tiebreakOutcomes, { bestOf, playAll })
}

function countDuelWins(
  homeId: string,
  awayId: string,
  series: MatchResultSummary[],
  disciplineId: string | null,
  scoringMode: ScoringMode,
  tiebreaker1: ScoringMode | null,
  tiebreaker2: ScoringMode | null,
  status: BestOfStatus
): { homeWins: number; awayWins: number } {
  const byDuel = new Map<number, { home?: DuelSeries; away?: DuelSeries }>()
  for (const s of series) {
    if (s.duelNumber === null || s.isTiebreak) continue
    const factor = effectiveTeilerFaktor(disciplineId, 1)
    const entry: DuelSeries = {
      rings: s.rings,
      correctedTeiler: s.teiler * factor,
      ringteiler: s.ringteiler,
    }
    const existing = byDuel.get(s.duelNumber) ?? {}
    if (s.participantId === homeId) {
      byDuel.set(s.duelNumber, { ...existing, home: entry })
    } else if (s.participantId === awayId) {
      byDuel.set(s.duelNumber, { ...existing, away: entry })
    }
  }

  // A Stechschuss-decided tie counts for the winner — same logic as the table.
  const regularOutcomes = Array.from(byDuel.entries())
    .filter(([, pair]) => pair.home && pair.away)
    .sort(([a], [b]) => a - b)
    .map(([, pair]) => duelOutcome(pair.home!, pair.away!, scoringMode, tiebreaker1, tiebreaker2))

  const { homeWins, awayWins } = bestOfDuelTally(regularOutcomes, status)
  return { homeWins, awayWins }
}

function completedDuelNumbers(
  homeId: string,
  awayId: string,
  series: MatchResultSummary[]
): number[] {
  const seenHome = new Set<number>()
  const seenAway = new Set<number>()
  for (const s of series) {
    if (s.duelNumber === null || s.isTiebreak) continue
    if (s.participantId === homeId) seenHome.add(s.duelNumber)
    if (s.participantId === awayId) seenAway.add(s.duelNumber)
  }
  const complete: number[] = []
  for (const n of seenHome) {
    if (seenAway.has(n)) complete.push(n)
  }
  return complete.sort((a, b) => a - b)
}

function completedStechschussNumbers(
  homeId: string,
  awayId: string,
  series: MatchResultSummary[]
): number[] {
  const seenHome = new Set<number>()
  const seenAway = new Set<number>()
  for (const s of series) {
    if (s.duelNumber === null || !s.isTiebreak) continue
    if (s.participantId === homeId) seenHome.add(s.duelNumber)
    if (s.participantId === awayId) seenAway.add(s.duelNumber)
  }
  const complete: number[] = []
  for (const n of seenHome) {
    if (seenAway.has(n)) complete.push(n)
  }
  return complete.sort((a, b) => a - b)
}

// ─── ShooterInput (shared input block per participant) ────────────────────────

interface ShooterInputProps {
  label: string
  idPrefix: string
  rings: string
  teiler: string
  scoringType: ScoringType
  shotsPerSeries: number
  teilerFaktor: number
  disciplineId: string | null
  isPending: boolean
  onRingsChange: (v: string) => void
  onTeilerChange: (v: string) => void
}

function ShooterInput({
  label,
  idPrefix,
  rings,
  teiler,
  scoringType,
  shotsPerSeries,
  teilerFaktor,
  disciplineId,
  isPending,
  onRingsChange,
  onTeilerChange,
}: ShooterInputProps) {
  const teilerNum = parseFloat(teiler.replace(",", "."))
  const effectiveFactor = effectiveTeilerFaktor(disciplineId, teilerFaktor)
  const correctedTeiler =
    isNaN(teilerNum) || effectiveFactor === 1 ? null : teilerNum * effectiveFactor

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-rings`} className="text-xs text-muted-foreground">
            Gesamtringe
          </Label>
          <RingsInput
            id={`${idPrefix}-rings`}
            scoringType={scoringType}
            shotsPerSeries={shotsPerSeries}
            value={rings}
            onChange={(e) => onRingsChange(e.target.value)}
            disabled={isPending}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-teiler`} className="text-xs text-muted-foreground">
            Bester Teiler
          </Label>
          <Input
            id={`${idPrefix}-teiler`}
            type="text"
            inputMode="decimal"
            value={teiler}
            onChange={(e) => onTeilerChange(e.target.value)}
            placeholder="z.B. 3,7"
            disabled={isPending}
          />
          {correctedTeiler !== null && (
            <p className="text-xs text-muted-foreground">
              Korr. Teiler: {correctedTeiler.toFixed(2).replace(".", ",")}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function BestOfEntryDialog({
  matchupId,
  homeParticipant,
  awayParticipant,
  series,
  canManage,
  hasResults,
  scoringMode,
  disciplineId,
  groupBestOf,
  groupPlayAllDuels,
  groupTiebreaker1,
  groupTiebreaker2,
  shotsPerSeries,
  scoringType,
  teilerFaktor,
}: Props) {
  const [open, setOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Duel input state
  const [homeRings, setHomeRings] = useState("")
  const [homeTeiler, setHomeTeiler] = useState("")
  const [awayRings, setAwayRings] = useState("")
  const [awayTeiler, setAwayTeiler] = useState("")

  // Stechschuss input state
  const [homeShot, setHomeShot] = useState("")
  const [awayShot, setAwayShot] = useState("")

  const homeId = homeParticipant.id
  const awayId = awayParticipant.id

  const homeName = `${homeParticipant.firstName} ${homeParticipant.lastName}`
  const awayName = `${awayParticipant.firstName} ${awayParticipant.lastName}`

  const matchStatus = deriveMatchStatus(
    homeId,
    awayId,
    series,
    disciplineId,
    scoringMode,
    groupTiebreaker1,
    groupTiebreaker2,
    groupBestOf,
    groupPlayAllDuels
  )

  const { homeWins, awayWins } = countDuelWins(
    homeId,
    awayId,
    series,
    disciplineId,
    scoringMode,
    groupTiebreaker1,
    groupTiebreaker2,
    matchStatus
  )

  const duelNumbers = completedDuelNumbers(homeId, awayId, series)
  const stechschussNumbers = completedStechschussNumbers(homeId, awayId, series)
  const nextDuelNumber = duelNumbers.length > 0 ? Math.max(...duelNumbers) + 1 : 1

  const isComplete = matchStatus.kind === "complete"
  const winnerId = isComplete ? (matchStatus.winner === "A" ? homeId : awayId) : null

  function handleOpenChange(isOpen: boolean) {
    if (isOpen) {
      // Reset input fields when opening
      setHomeRings("")
      setHomeTeiler("")
      setAwayRings("")
      setAwayTeiler("")
      setHomeShot("")
      setAwayShot("")
      setError(null)
    }
    setOpen(isOpen)
  }

  // ── Save duel ───────────────────────────────────────────────────────────────

  function handleSaveDuel() {
    const ringsH = parseFloat(homeRings.replace(",", "."))
    const teilerH = parseFloat(homeTeiler.replace(",", "."))
    const ringsA = parseFloat(awayRings.replace(",", "."))
    const teilerA = parseFloat(awayTeiler.replace(",", "."))

    if (isNaN(ringsH) || isNaN(teilerH) || isNaN(ringsA) || isNaN(teilerA)) {
      setError("Alle Felder (Ringe + Teiler) müssen ausgefüllt sein.")
      return
    }
    if (ringsH < 0 || ringsA < 0) {
      setError("Gesamtringe müssen positiv sein.")
      return
    }
    if (teilerH <= 0 || teilerA <= 0) {
      setError("Teiler müssen größer als 0 sein.")
      return
    }

    setError(null)
    startTransition(async () => {
      const result = await saveBestOfDuel({
        matchupId,
        duelNumber: nextDuelNumber,
        homeResult: { rings: ringsH, teiler: teilerH },
        awayResult: { rings: ringsA, teiler: teilerA },
      })
      if ("error" in result) {
        setError(typeof result.error === "string" ? result.error : "Fehler beim Speichern.")
      } else {
        setHomeRings("")
        setHomeTeiler("")
        setAwayRings("")
        setAwayTeiler("")
      }
    })
  }

  // ── Save Stechschuss ────────────────────────────────────────────────────────

  function handleSaveStechschuss() {
    const shotH = parseFloat(homeShot.replace(",", "."))
    const shotA = parseFloat(awayShot.replace(",", "."))

    if (isNaN(shotH) || isNaN(shotA)) {
      setError("Beide Schusswerte müssen ausgefüllt sein.")
      return
    }
    if (shotH < 0 || shotA < 0) {
      setError("Schusswerte müssen positiv sein.")
      return
    }

    setError(null)
    startTransition(async () => {
      const result = await saveStechschuss({
        matchupId,
        homeShot: shotH,
        awayShot: shotA,
      })
      if ("error" in result) {
        setError(typeof result.error === "string" ? result.error : "Fehler beim Speichern.")
      } else {
        setHomeShot("")
        setAwayShot("")
      }
    })
  }

  // ── Delete latest ───────────────────────────────────────────────────────────

  function handleDeleteLatest() {
    startTransition(async () => {
      const result = await deleteLatestBestOfDuel(matchupId)
      if ("error" in result) {
        setError(typeof result.error === "string" ? result.error : "Fehler beim Zurücknehmen.")
      }
      setConfirmDelete(false)
    })
  }

  if (!canManage) return null

  return (
    <>
      {/* Delete confirmation — rendered outside the main Dialog to avoid nesting issues */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Letztes Ergebnis zurücknehmen?</AlertDialogTitle>
            <AlertDialogDescription>
              Das zuletzt eingetragene Duell (oder der letzte Stechschuss) wird gelöscht. Diese
              Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteLatest}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Zurücknehmen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Trigger button */}
      {hasResults ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10"
          title="Duelle bearbeiten"
          onClick={() => setOpen(true)}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      ) : (
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10"
          title="Duelle eintragen"
          onClick={() => setOpen(true)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      )}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {homeName} – {awayName}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* Running score */}
            <div className="flex items-center gap-2 rounded-md bg-muted/30 px-3 py-2">
              <span
                className={`min-w-0 flex-1 truncate text-sm font-medium ${winnerId === homeId ? "text-emerald-600 dark:text-emerald-400" : ""}`}
              >
                {homeName}
              </span>
              <span className="shrink-0 text-lg font-bold tabular-nums">
                {homeWins} : {awayWins}
              </span>
              <span
                className={`min-w-0 flex-1 truncate text-right text-sm font-medium ${winnerId === awayId ? "text-emerald-600 dark:text-emerald-400" : ""}`}
              >
                {awayName}
              </span>
            </div>

            {/* Recorded regular duels */}
            {duelNumbers.length > 0 && (
              <div className="divide-y divide-border rounded-md border text-xs">
                {duelNumbers.map((dn) => {
                  const homeS = series.find(
                    (s) => s.participantId === homeId && s.duelNumber === dn && !s.isTiebreak
                  )
                  const awayS = series.find(
                    (s) => s.participantId === awayId && s.duelNumber === dn && !s.isTiebreak
                  )
                  const outcome =
                    homeS && awayS
                      ? duelOutcome(
                          {
                            rings: homeS.rings,
                            correctedTeiler: homeS.teiler * effectiveTeilerFaktor(disciplineId, 1),
                            ringteiler: homeS.ringteiler,
                          },
                          {
                            rings: awayS.rings,
                            correctedTeiler: awayS.teiler * effectiveTeilerFaktor(disciplineId, 1),
                            ringteiler: awayS.ringteiler,
                          },
                          scoringMode,
                          groupTiebreaker1,
                          groupTiebreaker2
                        )
                      : null

                  return (
                    <div key={dn} className="flex items-center gap-2 px-2 py-2 sm:px-3">
                      <span className="w-16 shrink-0 text-muted-foreground">Duell {dn}</span>
                      {homeS && awayS ? (
                        <>
                          <span
                            className={`min-w-0 flex-1 overflow-hidden text-right tabular-nums ${outcome === "A" ? "font-semibold text-emerald-600 dark:text-emerald-400" : ""}`}
                          >
                            {formatRings(homeS.rings, scoringType)}&nbsp;R&nbsp;·&nbsp;
                            {formatDecimal1(homeS.teiler)}&nbsp;T
                          </span>
                          <span className="shrink-0 text-muted-foreground">
                            {outcome === "A" ? "▸" : outcome === "B" ? "◂" : "="}
                          </span>
                          <span
                            className={`min-w-0 flex-1 overflow-hidden tabular-nums ${outcome === "B" ? "font-semibold text-emerald-600 dark:text-emerald-400" : ""}`}
                          >
                            {formatRings(awayS.rings, scoringType)}&nbsp;R&nbsp;·&nbsp;
                            {formatDecimal1(awayS.teiler)}&nbsp;T
                          </span>
                        </>
                      ) : (
                        <span className="flex-1 text-muted-foreground">Unvollständig</span>
                      )}
                    </div>
                  )
                })}

                {/* Recorded Stechschuss rounds */}
                {stechschussNumbers.map((dn) => {
                  const homeS = series.find(
                    (s) => s.participantId === homeId && s.duelNumber === dn && s.isTiebreak
                  )
                  const awayS = series.find(
                    (s) => s.participantId === awayId && s.duelNumber === dn && s.isTiebreak
                  )
                  const outcome =
                    homeS && awayS ? stechschussOutcome(homeS.rings, awayS.rings) : null

                  return (
                    <div key={`tb-${dn}`} className="flex items-center gap-2 px-2 py-2 sm:px-3">
                      <span className="w-16 shrink-0 text-muted-foreground">Stech.</span>
                      {homeS && awayS ? (
                        <>
                          <span
                            className={`min-w-0 flex-1 overflow-hidden text-right tabular-nums ${outcome === "A" ? "font-semibold text-emerald-600 dark:text-emerald-400" : ""}`}
                          >
                            {homeS.rings.toFixed(1).replace(".", ",")}
                          </span>
                          <span className="shrink-0 text-muted-foreground">
                            {outcome === "A" ? "▸" : outcome === "B" ? "◂" : "="}
                          </span>
                          <span
                            className={`min-w-0 flex-1 overflow-hidden tabular-nums ${outcome === "B" ? "font-semibold text-emerald-600 dark:text-emerald-400" : ""}`}
                          >
                            {awayS.rings.toFixed(1).replace(".", ",")}
                          </span>
                        </>
                      ) : (
                        <span className="flex-1 text-muted-foreground">Unvollständig</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Next duel input */}
            {matchStatus.kind === "in_progress" && (
              <div className="space-y-3 rounded-md border bg-muted/20 px-3 py-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Duell {nextDuelNumber} eintragen
                </p>
                <ShooterInput
                  label={homeName}
                  idPrefix={`home-d${nextDuelNumber}`}
                  rings={homeRings}
                  teiler={homeTeiler}
                  scoringType={scoringType}
                  shotsPerSeries={shotsPerSeries}
                  teilerFaktor={teilerFaktor}
                  disciplineId={disciplineId}
                  isPending={isPending}
                  onRingsChange={setHomeRings}
                  onTeilerChange={setHomeTeiler}
                />
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs text-muted-foreground">vs.</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <ShooterInput
                  label={awayName}
                  idPrefix={`away-d${nextDuelNumber}`}
                  rings={awayRings}
                  teiler={awayTeiler}
                  scoringType={scoringType}
                  shotsPerSeries={shotsPerSeries}
                  teilerFaktor={teilerFaktor}
                  disciplineId={disciplineId}
                  isPending={isPending}
                  onRingsChange={setAwayRings}
                  onTeilerChange={setAwayTeiler}
                />
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button size="sm" className="w-full" onClick={handleSaveDuel} disabled={isPending}>
                  {isPending ? "Speichern…" : "Duell speichern"}
                </Button>
              </div>
            )}

            {/* Stechschuss input */}
            {matchStatus.kind === "needs_tiebreak" && (
              <div className="space-y-3 rounded-md border bg-muted/20 px-3 py-3">
                <p className="text-xs font-medium text-muted-foreground">Stechschuss eintragen</p>
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="dialog-home-shot" className="text-xs text-muted-foreground">
                        {homeName}
                      </Label>
                      <Input
                        id="dialog-home-shot"
                        type="text"
                        inputMode="decimal"
                        placeholder="z.B. 9,8"
                        value={homeShot}
                        onChange={(e) => setHomeShot(e.target.value)}
                        disabled={isPending}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="dialog-away-shot" className="text-xs text-muted-foreground">
                        {awayName}
                      </Label>
                      <Input
                        id="dialog-away-shot"
                        type="text"
                        inputMode="decimal"
                        placeholder="z.B. 9,5"
                        value={awayShot}
                        onChange={(e) => setAwayShot(e.target.value)}
                        disabled={isPending}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Ein Schuss — höchster Wert gewinnt.
                  </p>
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button
                  size="sm"
                  className="w-full"
                  onClick={handleSaveStechschuss}
                  disabled={isPending}
                >
                  {isPending ? "Speichern…" : "Stechschuss speichern"}
                </Button>
              </div>
            )}

            {/* Complete — no further input, undo available */}
            {isComplete && duelNumbers.length === 0 && stechschussNumbers.length === 0 && (
              <p className="text-center text-sm text-muted-foreground">Keine Duelle erfasst.</p>
            )}

            {error && isComplete && <p className="text-sm text-destructive">{error}</p>}

            {/* Progress hint */}
            {!isComplete && (
              <p className="text-center text-xs text-muted-foreground">
                Best-of-{groupBestOf} · Siegerstand {Math.ceil(groupBestOf / 2)}
                {groupPlayAllDuels ? " · alle Duelle werden ausgetragen" : ""}
              </p>
            )}
          </div>

          <DialogFooter className="flex-row items-center justify-between sm:justify-between">
            {/* Undo button — only shown when there is something to undo */}
            <div>
              {(duelNumbers.length > 0 || stechschussNumbers.length > 0) && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 text-destructive/70 hover:text-destructive"
                  title="Letztes Duell/Stechschuss zurücknehmen"
                  onClick={() => setConfirmDelete(true)}
                  disabled={isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Schließen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

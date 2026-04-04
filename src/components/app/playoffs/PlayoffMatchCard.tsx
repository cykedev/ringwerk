"use client"

import { useState, useTransition } from "react"
import { Plus, Trash2, Trophy } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { toast } from "sonner"
import { addPlayoffDuel, deleteLastPlayoffDuel } from "@/lib/playoffs/actions"
import { requiredWinsFromBestOf } from "@/lib/playoffs/calculatePlayoffs"
import type { PlayoffMatchItem } from "@/lib/playoffs/types"
import type { ScoringMode, ScoringType } from "@/generated/prisma/client"
import { PlayoffDuelResultDialog } from "./PlayoffDuelResultDialog"
import { SCORING_MODE_LABELS } from "@/lib/scoring/labels"

function finaleHintText(
  primary: ScoringMode,
  tb1: ScoringMode | null,
  tb2: ScoringMode | null
): string {
  const label = (m: ScoringMode) => SCORING_MODE_LABELS[m] ?? m
  const parts = [`Primär: ${label(primary)}`]
  if (tb1) parts.push(`TB: ${label(tb1)}`)
  if (tb2) parts.push(`TB2: ${label(tb2)}`)
  return parts.join(" · ")
}

interface Props {
  match: PlayoffMatchItem
  canManage: boolean
  scoringType: ScoringType
  shotsPerSeries: number
  playoffBestOf: number | null
  finalePrimary: ScoringMode
  finaleTiebreaker1: ScoringMode | null
  finaleTiebreaker2: ScoringMode | null
}

const ROUND_LABEL: Record<string, string> = {
  EIGHTH_FINAL: "Achtelfinale",
  QUARTER_FINAL: "Viertelfinale",
  SEMI_FINAL: "Halbfinale",
  FINAL: "Finale",
}

// Gold / Silber / Bronze je nach Runde
const WINNER_BADGE: Record<string, string> = {
  FINAL: "border-yellow-400/60 bg-yellow-400/10 text-yellow-600 dark:text-yellow-400",
  SEMI_FINAL: "border-slate-400/60 bg-slate-400/10 text-slate-500 dark:text-slate-300",
  QUARTER_FINAL: "border-orange-500/60 bg-orange-500/10 text-orange-600 dark:text-orange-400",
  EIGHTH_FINAL: "border-blue-500/60 bg-blue-500/10 text-blue-600 dark:text-blue-400",
}

export function PlayoffMatchCard({
  match,
  canManage,
  scoringType,
  shotsPerSeries,
  playoffBestOf,
  finalePrimary,
  finaleTiebreaker1,
  finaleTiebreaker2,
}: Props) {
  const requiredWins = requiredWinsFromBestOf(playoffBestOf)
  const bestOfLabel = playoffBestOf ? `Best-of-${playoffBestOf}` : "Best-of-Five"
  const [isPending, startTransition] = useTransition()
  const [confirmDuelId, setConfirmDuelId] = useState<string | null>(null)

  const isFinal = match.round === "FINAL"
  const isCompleted = match.status === "COMPLETED"
  const winnerId =
    match.winsA > match.winsB
      ? match.participantA.id
      : match.winsB > match.winsA
        ? match.participantB.id
        : null

  // Nächstes offenes Duell (für "Eintragen"-Button)
  const nextPendingDuel = match.duels.find((d) => !d.isCompleted)

  // Letztes Duell (für Delete-Button)
  const lastDuelId = match.duels.length > 0 ? match.duels[match.duels.length - 1].id : null

  // Ob "Duell anlegen"-Button angezeigt werden soll:
  // - Nicht-Finale: wenn kein offenes Duell vorhanden (deckt auch 0 Duelle ab)
  // - Finale: nur wenn noch gar kein Duell angelegt wurde (Folge-Duelle via SD automatisch)
  const canAddDuel =
    canManage &&
    !isCompleted &&
    nextPendingDuel === undefined &&
    (!isFinal || match.duels.length === 0)

  function handleAddDuel() {
    startTransition(async () => {
      const result = await addPlayoffDuel(match.id)
      if ("error" in result) {
        toast.error(
          typeof result.error === "string" ? result.error : "Fehler beim Anlegen des Duells."
        )
      }
    })
  }

  function handleDeleteDuel() {
    if (!confirmDuelId) return
    startTransition(async () => {
      const result = await deleteLastPlayoffDuel(confirmDuelId)
      if ("error" in result) {
        toast.error(
          typeof result.error === "string" ? result.error : "Fehler beim Löschen des Duells."
        )
      }
      setConfirmDuelId(null)
    })
  }

  const nameA = `${match.participantA.firstName} ${match.participantA.lastName}`
  const nameB = `${match.participantB.firstName} ${match.participantB.lastName}`

  return (
    <>
      <AlertDialog open={!!confirmDuelId} onOpenChange={(open) => !open && setConfirmDuelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Duell löschen?</AlertDialogTitle>
            <AlertDialogDescription>Dieses Duell wirklich löschen?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteDuel}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Card className={isCompleted ? "border-muted" : ""}>
        <CardHeader className="px-4 pb-2 sm:px-6">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {ROUND_LABEL[match.round]}
            </CardTitle>
            {isCompleted && winnerId && (
              <Badge
                variant="outline"
                className={`gap-1 text-xs ${WINNER_BADGE[match.round] ?? ""}`}
              >
                <Trophy className="h-3 w-3" />
                {winnerId === match.participantA.id ? nameA : nameB}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-3 px-4 sm:px-6">
          {/* Stand */}
          <div className="flex items-center gap-2">
            <span
              className={`min-w-0 flex-1 truncate text-sm font-medium ${winnerId === match.participantA.id ? "text-emerald-600 dark:text-emerald-400" : ""}`}
            >
              {nameA}
            </span>
            <span className="shrink-0 tabular-nums text-lg font-bold">
              {match.winsA} : {match.winsB}
            </span>
            <span
              className={`min-w-0 flex-1 truncate text-right text-sm font-medium ${winnerId === match.participantB.id ? "text-emerald-600 dark:text-emerald-400" : ""}`}
            >
              {nameB}
            </span>
          </div>

          {/* Duell-Liste */}
          {match.duels.length > 0 && (
            <div className="divide-y divide-border rounded-md border text-xs">
              {match.duels.map((duel) => {
                const isWinnerA = duel.winnerId === match.participantA.id
                const isWinnerB = duel.winnerId === match.participantB.id
                const isDraw = duel.isCompleted && duel.winnerId === null

                return (
                  <div key={duel.id} className="flex items-center gap-2 px-2 py-2 sm:px-3">
                    <span className="w-20 text-muted-foreground">
                      {duel.isSuddenDeath
                        ? isFinal
                          ? "Verlängerung"
                          : "Entscheid"
                        : isFinal
                          ? `${shotsPerSeries}\u00A0Sch.`
                          : `Duell ${duel.duelNumber}`}
                    </span>

                    {duel.isCompleted && duel.resultA && duel.resultB ? (
                      <>
                        <span
                          className={`min-w-0 flex-1 overflow-hidden text-right tabular-nums ${isWinnerA ? "font-semibold text-emerald-600 dark:text-emerald-400" : ""}`}
                        >
                          {isFinal
                            ? `${duel.resultA.totalRings}\u00A0Ringe`
                            : `RT\u00A0${(duel.resultA.ringteiler ?? 0).toFixed(1)}`}
                        </span>
                        <span className="shrink-0 text-muted-foreground">
                          {isDraw ? (
                            <>
                              <span className="hidden sm:inline">Unentschieden</span>
                              <span className="sm:hidden">=</span>
                            </>
                          ) : isWinnerA ? (
                            "▸"
                          ) : (
                            "◂"
                          )}
                        </span>
                        <span
                          className={`min-w-0 flex-1 overflow-hidden tabular-nums ${isWinnerB ? "font-semibold text-emerald-600 dark:text-emerald-400" : ""}`}
                        >
                          {isFinal
                            ? `${duel.resultB.totalRings}\u00A0Ringe`
                            : `RT\u00A0${(duel.resultB.ringteiler ?? 0).toFixed(1)}`}
                        </span>
                        {canManage && match.canCorrect && (
                          <>
                            <PlayoffDuelResultDialog
                              duel={duel}
                              participantA={match.participantA}
                              participantB={match.participantB}
                              isCorrection={true}
                              isFinalMatch={isFinal}
                              scoringType={scoringType}
                              shotsPerSeries={shotsPerSeries}
                              finalePrimary={finalePrimary}
                              finaleTiebreaker1={finaleTiebreaker1}
                              finaleTiebreaker2={finaleTiebreaker2}
                            />
                            {duel.id === lastDuelId && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-destructive hover:text-destructive"
                                onClick={() => setConfirmDuelId(duel.id)}
                                disabled={isPending}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        <span className="flex-1" />
                        {canManage && duel.id === nextPendingDuel?.id && (
                          <>
                            <PlayoffDuelResultDialog
                              duel={duel}
                              participantA={match.participantA}
                              participantB={match.participantB}
                              isCorrection={false}
                              isFinalMatch={isFinal}
                              scoringType={scoringType}
                              shotsPerSeries={shotsPerSeries}
                              finalePrimary={finalePrimary}
                              finaleTiebreaker1={finaleTiebreaker1}
                              finaleTiebreaker2={finaleTiebreaker2}
                            />
                            {match.canCorrect && duel.id === lastDuelId && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                                onClick={() => setConfirmDuelId(duel.id)}
                                disabled={isPending}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Duell anlegen */}
          {canAddDuel && (
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              onClick={handleAddDuel}
              disabled={isPending}
            >
              <Plus className="mr-1 h-3 w-3" />
              {isPending
                ? "Anlegen…"
                : isFinal
                  ? `${shotsPerSeries} Schüsse anlegen`
                  : match.duels.length === 0
                    ? "Erstes Duell anlegen"
                    : "Nächstes Duell anlegen"}
            </Button>
          )}

          {/* Hinweis */}
          {!isCompleted &&
            (isFinal ? (
              <p className="text-center text-xs text-muted-foreground">
                {finaleHintText(finalePrimary, finaleTiebreaker1, finaleTiebreaker2)} · bei
                Gleichstand Verlängerung
              </p>
            ) : (
              <p className="text-center text-xs text-muted-foreground">
                {bestOfLabel} · noch {requiredWins - Math.max(match.winsA, match.winsB)} Siege zum
                Weiterkommen
              </p>
            ))}
        </CardContent>
      </Card>
    </>
  )
}

"use client"

import { useTransition } from "react"
import { Plus, Trophy } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { addPlayoffDuel } from "@/lib/playoffs/actions"
import type { PlayoffMatchItem } from "@/lib/playoffs/types"
import { PlayoffDuelResultDialog } from "./PlayoffDuelResultDialog"

interface Props {
  match: PlayoffMatchItem
  isAdmin: boolean
}

const ROUND_LABEL: Record<string, string> = {
  QUARTER_FINAL: "Viertelfinale",
  SEMI_FINAL: "Halbfinale",
  FINAL: "Finale",
}

// Gold / Silber / Bronze je nach Runde
const WINNER_BADGE: Record<string, string> = {
  FINAL: "border-yellow-400/60 bg-yellow-400/10 text-yellow-600 dark:text-yellow-400",
  SEMI_FINAL: "border-slate-400/60 bg-slate-400/10 text-slate-500 dark:text-slate-300",
  QUARTER_FINAL: "border-orange-500/60 bg-orange-500/10 text-orange-600 dark:text-orange-400",
}

export function PlayoffMatchCard({ match, isAdmin }: Props) {
  const [isPending, startTransition] = useTransition()

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

  // Ob "Neues Duell"-Button angezeigt werden soll
  // VF/HF: wenn kein pending Duell, Match nicht abgeschlossen und BoF noch offen
  // Finale: kein manueller "Neues Duell"-Button (SD wird automatisch nach DRAW angelegt)
  const canAddDuel =
    isAdmin && !isCompleted && !isFinal && nextPendingDuel === undefined && match.duels.length < 5

  function handleAddDuel() {
    startTransition(async () => {
      const result = await addPlayoffDuel(match.id)
      if ("error" in result) {
        alert(typeof result.error === "string" ? result.error : "Fehler beim Anlegen des Duells.")
      }
    })
  }

  const nameA = `${match.participantA.firstName} ${match.participantA.lastName}`
  const nameB = `${match.participantB.firstName} ${match.participantB.lastName}`

  return (
    <Card className={isCompleted ? "border-muted" : ""}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {ROUND_LABEL[match.round]}
          </CardTitle>
          {isCompleted && winnerId && (
            <Badge variant="outline" className={`gap-1 text-xs ${WINNER_BADGE[match.round] ?? ""}`}>
              <Trophy className="h-3 w-3" />
              {winnerId === match.participantA.id ? nameA : nameB}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Stand */}
        <div className="flex items-center justify-between">
          <span
            className={`text-sm font-medium ${winnerId === match.participantA.id ? "text-emerald-600 dark:text-emerald-400" : ""}`}
          >
            {nameA}
          </span>
          <span className="tabular-nums text-lg font-bold">
            {match.winsA} : {match.winsB}
          </span>
          <span
            className={`text-sm font-medium text-right ${winnerId === match.participantB.id ? "text-emerald-600 dark:text-emerald-400" : ""}`}
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
                <div key={duel.id} className="flex items-center gap-2 px-3 py-2">
                  <span className="w-20 text-muted-foreground">
                    {duel.isSuddenDeath
                      ? isFinal
                        ? "Verlängerung"
                        : "Entscheid"
                      : isFinal
                        ? "10 Schüsse"
                        : `Duell ${duel.duelNumber}`}
                  </span>

                  {duel.isCompleted && duel.resultA && duel.resultB ? (
                    <>
                      <span
                        className={`flex-1 text-right tabular-nums ${isWinnerA ? "font-semibold text-emerald-600 dark:text-emerald-400" : ""}`}
                      >
                        {isFinal
                          ? `${duel.resultA.totalRings} Ringe`
                          : `RT ${(duel.resultA.ringteiler ?? 0).toFixed(1)}`}
                      </span>
                      <span className="text-muted-foreground">
                        {isDraw ? "Unentschieden" : isWinnerA ? "▸" : "◂"}
                      </span>
                      <span
                        className={`flex-1 tabular-nums ${isWinnerB ? "font-semibold text-emerald-600 dark:text-emerald-400" : ""}`}
                      >
                        {isFinal
                          ? `${duel.resultB.totalRings} Ringe`
                          : `RT ${(duel.resultB.ringteiler ?? 0).toFixed(1)}`}
                      </span>
                      {isAdmin && (
                        <PlayoffDuelResultDialog
                          duel={duel}
                          participantA={match.participantA}
                          participantB={match.participantB}
                          isCorrection={true}
                          isFinalMatch={isFinal}
                        />
                      )}
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-center text-muted-foreground">ausstehend</span>
                      {isAdmin && duel.id === nextPendingDuel?.id && (
                        <PlayoffDuelResultDialog
                          duel={duel}
                          participantA={match.participantA}
                          participantB={match.participantB}
                          isCorrection={false}
                          isFinalMatch={isFinal}
                        />
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Erstes Duell anlegen (wenn noch keine Duels vorhanden) */}
        {isAdmin && !isCompleted && match.duels.length === 0 && (
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs"
            onClick={handleAddDuel}
            disabled={isPending}
          >
            <Plus className="mr-1 h-3 w-3" />
            {isPending ? "Anlegen…" : isFinal ? "10 Schüsse anlegen" : "Erstes Duell anlegen"}
          </Button>
        )}

        {/* Weiteres Duell anlegen (VF/HF, kein pending) */}
        {canAddDuel && (
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs"
            onClick={handleAddDuel}
            disabled={isPending}
          >
            <Plus className="mr-1 h-3 w-3" />
            {isPending ? "Anlegen…" : "Nächstes Duell anlegen"}
          </Button>
        )}

        {/* Hinweis */}
        {!isCompleted &&
          (isFinal ? (
            <p className="text-center text-xs text-muted-foreground">
              Höchste Ringzahl gewinnt · bei Gleichstand Verlängerung
            </p>
          ) : (
            <p className="text-center text-xs text-muted-foreground">
              Best-of-Five · noch {3 - Math.max(match.winsA, match.winsB)} Siege zum Weiterkommen
            </p>
          ))}
      </CardContent>
    </Card>
  )
}

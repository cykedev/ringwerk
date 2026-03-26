"use client"

import { useActionState, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Lock } from "lucide-react"
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
import type { SerializableDiscipline } from "@/lib/disciplines/types"
import type { CompetitionDetail } from "@/lib/competitions/types"
import type { ActionResult } from "@/lib/types"

interface Props {
  competition?: CompetitionDetail
  disciplines: SerializableDiscipline[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  action: (prevState: ActionResult<any> | null, formData: FormData) => Promise<ActionResult<any>>
  hasMatchups?: boolean
}

const SCORING_MODE_LABELS: Record<string, string> = {
  RINGTEILER: "Ringteiler (Standard)",
  RINGS: "Ringe (ganzzahlig)",
  RINGS_DECIMAL: "Ringe (Zehntelwertung)",
  TEILER: "Teiler",
  DECIMAL_REST: "Dezimalrest",
  TARGET_ABSOLUTE: "Zielwert (absolut)",
  TARGET_UNDER: "Zielwert (unter)",
}

// DECIMAL_REST benötigt Einzelschüsse — nur für Liga verfügbar
const EVENT_SCORING_MODE_LABELS = Object.fromEntries(
  Object.entries(SCORING_MODE_LABELS).filter(([k]) => k !== "DECIMAL_REST")
)

// Saison: nur Wertungen die auf Serien-Basis sinnvoll sind
const SEASON_SCORING_MODE_LABELS = Object.fromEntries(
  Object.entries(SCORING_MODE_LABELS).filter(([k]) =>
    ["RINGS", "RINGS_DECIMAL", "TEILER", "RINGTEILER"].includes(k)
  )
)

const TARGET_VALUE_TYPE_LABELS: Record<string, string> = {
  RINGS: "Ringe (ganzzahlig)",
  RINGS_DECIMAL: "Ringe (Zehntelwertung)",
  TEILER: "Teiler (korrigiert)",
}

function toDateInputValue(date: Date | null | undefined): string {
  if (!date) return ""
  return new Date(date).toISOString().slice(0, 10)
}

export function CompetitionForm({ competition, disciplines, action, hasMatchups = false }: Props) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(action, null)
  const isEdit = !!competition

  const [type, setType] = useState<string>(competition?.type ?? "LEAGUE")
  const [scoringMode, setScoringMode] = useState<string>(competition?.scoringMode ?? "RINGTEILER")
  const [allowGuests, setAllowGuests] = useState<boolean>(competition?.allowGuests ?? false)
  const [teamSize, setTeamSize] = useState<string>(String(competition?.teamSize ?? ""))
  const [finalePrimary, setFinalePrimary] = useState<string>(competition?.finalePrimary ?? "RINGS")
  const [finaleTiebreaker1, setFinaleTiebreaker1] = useState<string>(
    competition?.finaleTiebreaker1 ?? "none"
  )
  const [finaleTiebreaker2, setFinaleTiebreaker2] = useState<string>(
    competition?.finaleTiebreaker2 ?? "none"
  )
  const [finaleHasSuddenDeath, setFinaleHasSuddenDeath] = useState<boolean>(
    competition?.finaleHasSuddenDeath ?? true
  )

  useEffect(() => {
    if (state && "success" in state && state.success) {
      const id = (state.data as { id?: string } | undefined)?.id
      if (id) {
        router.push(`/competitions/${id}/participants`)
      } else {
        router.push("/competitions")
      }
    }
  }, [state, router])

  const fieldErrors =
    state && "error" in state && typeof state.error === "object" ? state.error : null
  const generalError =
    state && "error" in state && typeof state.error === "string" ? state.error : null

  const isTargetMode = scoringMode === "TARGET_ABSOLUTE" || scoringMode === "TARGET_UNDER"

  return (
    <form action={formAction} className="space-y-4">
      {/* Typ (nur bei Erstellung) */}
      {!isEdit && (
        <div className="space-y-2">
          <Label htmlFor="type">Typ</Label>
          <Select name="type" value={type} onValueChange={setType} disabled={isPending}>
            <SelectTrigger id="type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="LEAGUE">Liga</SelectItem>
              <SelectItem value="EVENT">Event (Kranzlschiessen)</SelectItem>
              <SelectItem value="SEASON">Saison (Jahrespreisschiessen)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          defaultValue={competition?.name ?? ""}
          placeholder={
            type === "EVENT"
              ? "z.B. Kranzlschiessen 2026"
              : type === "SEASON"
                ? "z.B. Jahrespreisschiessen 2026"
                : "z.B. Winterliga 2026"
          }
          disabled={isPending}
        />
        {fieldErrors?.name && <p className="text-sm text-destructive">{fieldErrors.name[0]}</p>}
      </div>

      {/* Wertungsmodus */}
      <div className="space-y-2">
        <Label htmlFor="scoringMode">Wertungsmodus</Label>
        <Select
          name="scoringMode"
          value={scoringMode}
          onValueChange={setScoringMode}
          disabled={
            isPending || (hasMatchups && (type === "LEAGUE" || competition?.type === "LEAGUE"))
          }
        >
          <SelectTrigger id="scoringMode">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(
              type === "SEASON" || type === "LEAGUE"
                ? SEASON_SCORING_MODE_LABELS
                : EVENT_SCORING_MODE_LABELS
            ).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Schusszahl (nur für Event/Saison — Liga hat es im Regelset) */}
      {type !== "LEAGUE" && !(isEdit && competition?.type === "LEAGUE") && (
        <div className="space-y-2">
          <Label htmlFor="shotsPerSeries">Schuss pro Serie</Label>
          <Input
            id="shotsPerSeries"
            name="shotsPerSeries"
            type="number"
            min={1}
            max={100}
            defaultValue={competition?.shotsPerSeries ?? 10}
            disabled={isPending}
          />
        </div>
      )}

      {/* Disziplin */}
      <div className="space-y-2">
        <Label htmlFor="disciplineId">Disziplin</Label>
        <Select
          name="disciplineId"
          defaultValue={competition?.disciplineId ?? "mixed"}
          disabled={isPending || isEdit}
        >
          <SelectTrigger id="disciplineId">
            <SelectValue placeholder="Disziplin wählen…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mixed">Gemischt (Faktor-Korrektur)</SelectItem>
            {disciplines.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isEdit && (
          <p className="text-xs text-muted-foreground">
            Die Disziplin kann nach der Erstellung nicht mehr geändert werden.
          </p>
        )}
        {fieldErrors?.disciplineId && (
          <p className="text-sm text-destructive">{fieldErrors.disciplineId[0]}</p>
        )}
      </div>

      {/* ── Saison-Felder ────────────────────────────────────────── */}
      {(type === "SEASON" || (isEdit && competition?.type === "SEASON")) && (
        <>
          <div className="space-y-2">
            <Label htmlFor="minSeries">Mindestserien (optional)</Label>
            <Input
              id="minSeries"
              name="minSeries"
              type="number"
              min={1}
              max={999}
              defaultValue={competition?.minSeries ?? ""}
              placeholder="z.B. 20"
              disabled={isPending}
            />
            <p className="text-xs text-muted-foreground">
              Teilnehmer mit weniger Serien werden in der Rangliste ausgegraut.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="seasonStart">Saisonbeginn (optional)</Label>
            <Input
              id="seasonStart"
              name="seasonStart"
              type="date"
              defaultValue={toDateInputValue(competition?.seasonStart)}
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="seasonEnd">Saisonende (optional)</Label>
            <Input
              id="seasonEnd"
              name="seasonEnd"
              type="date"
              defaultValue={toDateInputValue(competition?.seasonEnd)}
              disabled={isPending}
            />
          </div>
        </>
      )}

      {/* ── Liga-Felder ─────────────────────────────────────────── */}
      {(type === "LEAGUE" || (isEdit && competition?.type === "LEAGUE")) && (
        <>
          <div className="space-y-2">
            <Label htmlFor="hinrundeDeadline">Hinrunde-Stichtag (optional)</Label>
            <Input
              id="hinrundeDeadline"
              name="hinrundeDeadline"
              type="date"
              defaultValue={toDateInputValue(competition?.hinrundeDeadline)}
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rueckrundeDeadline">Rückrunde-Stichtag (optional)</Label>
            <Input
              id="rueckrundeDeadline"
              name="rueckrundeDeadline"
              type="date"
              defaultValue={toDateInputValue(competition?.rueckrundeDeadline)}
              disabled={isPending}
            />
          </div>

          {/* ── Regelset ──────────────────────────────────────────── */}
          <div className="rounded-lg border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <p className="text-sm font-medium">Regelset (Playoffs)</p>
              {hasMatchups && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Lock className="h-3 w-3" />
                  Gesperrt — Paarungen existieren bereits
                </span>
              )}
            </div>
            <fieldset disabled={hasMatchups || isPending} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="playoffBestOf">Best-of (VF/HF)</Label>
                  <Input
                    id="playoffBestOf"
                    name="playoffBestOf"
                    type="number"
                    min={1}
                    max={9}
                    step={2}
                    defaultValue={competition?.playoffBestOf ?? 5}
                    placeholder="5"
                  />
                  <p className="text-xs text-muted-foreground">z.B. 5 = Best-of-5 (3 Siege)</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shotsPerSeriesLeague">Schuss/Serie</Label>
                  <Input
                    id="shotsPerSeriesLeague"
                    name="shotsPerSeries"
                    type="number"
                    min={1}
                    max={100}
                    defaultValue={competition?.shotsPerSeries ?? 10}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <input
                    id="playoffHasViertelfinale"
                    name="playoffHasViertelfinale"
                    type="checkbox"
                    value="true"
                    defaultChecked={competition?.playoffHasViertelfinale ?? true}
                  />
                  <Label htmlFor="playoffHasViertelfinale">Viertelfinale (8 TN)</Label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="playoffHasAchtelfinale"
                    name="playoffHasAchtelfinale"
                    type="checkbox"
                    value="true"
                    defaultChecked={competition?.playoffHasAchtelfinale ?? false}
                  />
                  <Label htmlFor="playoffHasAchtelfinale">Achtelfinale (16 TN)</Label>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="finalePrimary">Finale – Hauptkriterium</Label>
                <Select name="finalePrimary" value={finalePrimary} onValueChange={setFinalePrimary}>
                  <SelectTrigger id="finalePrimary">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SEASON_SCORING_MODE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Primäres Wertungskriterium im Finale (immer aktiv).
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="finaleTiebreaker1">Finale – Tiebreaker 1</Label>
                <Select
                  name="finaleTiebreaker1"
                  value={finaleTiebreaker1}
                  onValueChange={(v) => {
                    setFinaleTiebreaker1(v)
                    if (v === "none") setFinaleTiebreaker2("none")
                  }}
                >
                  <SelectTrigger id="finaleTiebreaker1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Kein Tiebreaker</SelectItem>
                    {Object.entries(SEASON_SCORING_MODE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Bei Gleichstand nach Hauptkriterium (optional).
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="finaleTiebreaker2">Finale – Tiebreaker 2</Label>
                <Select
                  name="finaleTiebreaker2"
                  value={finaleTiebreaker2}
                  onValueChange={setFinaleTiebreaker2}
                  disabled={finaleTiebreaker1 === "none"}
                >
                  <SelectTrigger id="finaleTiebreaker2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Kein Tiebreaker</SelectItem>
                    {Object.entries(SEASON_SCORING_MODE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Bei Gleichstand nach Tiebreaker 1 (nur wenn TB1 gesetzt).
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="finaleHasSuddenDeath"
                  name="finaleHasSuddenDeath"
                  checked={finaleHasSuddenDeath}
                  onCheckedChange={(checked: boolean | "indeterminate") =>
                    setFinaleHasSuddenDeath(checked === true)
                  }
                />
                <Label htmlFor="finaleHasSuddenDeath" className="cursor-pointer">
                  Sudden Death bei Finale-Gleichstand
                </Label>
              </div>
              <input
                type="hidden"
                name="finaleHasSuddenDeath"
                value={finaleHasSuddenDeath ? "true" : "false"}
              />
            </fieldset>
          </div>
        </>
      )}

      {/* ── Event-Felder ─────────────────────────────────────────── */}
      {(type === "EVENT" || (isEdit && competition?.type === "EVENT")) && (
        <>
          <div className="space-y-2">
            <Label htmlFor="eventDate">Veranstaltungsdatum (optional)</Label>
            <Input
              id="eventDate"
              name="eventDate"
              type="date"
              defaultValue={toDateInputValue(competition?.eventDate)}
              disabled={isPending}
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="allowGuests"
              name="allowGuests"
              checked={allowGuests}
              onCheckedChange={(checked: boolean | "indeterminate") =>
                setAllowGuests(checked === true)
              }
              disabled={isPending}
            />
            <Label htmlFor="allowGuests" className="cursor-pointer">
              Gastteilnehmer erlaubt
            </Label>
          </div>
          {/* Hidden field damit der Wert immer im FormData landet */}
          <input type="hidden" name="allowGuests" value={allowGuests ? "true" : "false"} />

          {/* Team-Modus */}
          <div className="space-y-2">
            <Label htmlFor="teamSize">Teamgröße (optional)</Label>
            <Input
              id="teamSize"
              name="teamSize"
              type="number"
              min={2}
              max={20}
              value={teamSize}
              onChange={(e) => setTeamSize(e.target.value)}
              placeholder="z.B. 2 für Zweier-Teams"
              disabled={isPending}
            />
            <p className="text-xs text-muted-foreground">
              Leer lassen für Einzelwertung. Ab 2 wird ein Team-Modus aktiviert.
            </p>
          </div>

          {Number(teamSize) >= 2 && (
            <div className="space-y-2">
              <Label htmlFor="teamScoring">Team-Wertung</Label>
              <Select
                name="teamScoring"
                defaultValue={competition?.teamScoring ?? "SUM"}
                disabled={isPending}
              >
                <SelectTrigger id="teamScoring">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SUM">Summe (alle Einzel-Ergebnisse addiert)</SelectItem>
                  <SelectItem value="BEST">Bestes (bestes Einzelergebnis im Team)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {isTargetMode && (
            <>
              <div className="space-y-2">
                <Label htmlFor="targetValue">Zielwert</Label>
                <Input
                  id="targetValue"
                  name="targetValue"
                  type="number"
                  step="0.1"
                  min={0}
                  defaultValue={competition?.targetValue ?? ""}
                  placeholder="z.B. 512"
                  disabled={isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="targetValueType">Zielwert-Typ</Label>
                <Select
                  name="targetValueType"
                  defaultValue={competition?.targetValueType ?? "RINGS"}
                  disabled={isPending}
                >
                  <SelectTrigger id="targetValueType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TARGET_VALUE_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </>
      )}

      {generalError && <p className="text-sm text-destructive">{generalError}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Speichern…" : "Speichern"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={isPending}>
          Abbrechen
        </Button>
      </div>
    </form>
  )
}

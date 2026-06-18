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
import { SCORING_MODE_LABELS } from "@/lib/scoring/labels"
import { slugify, SLUG_REGEX } from "@/lib/competitions/publicSlug"

interface Props {
  competition?: CompetitionDetail
  disciplines: SerializableDiscipline[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  action: (prevState: ActionResult<any> | null, formData: FormData) => Promise<ActionResult<any>>
  /** Gruppenphase/Format sperren, sobald Paarungen existieren. */
  hasMatchups?: boolean
  /** Playoff-/Finale-Einstellungen sperren, sobald die Playoffs gestartet sind. */
  playoffsStarted?: boolean
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

// BEST_OF_SINGLE group phase: only modes where a head-to-head duel yields a clear numeric result
const BEST_OF_SINGLE_SCORING_MODE_LABELS = Object.fromEntries(
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

export function CompetitionForm({
  competition,
  disciplines,
  action,
  hasMatchups = false,
  playoffsStarted = false,
}: Props) {
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

  // BEST_OF_SINGLE group-phase config
  const [leagueFormat, setLeagueFormat] = useState<string>(
    competition?.leagueFormat ?? "DOUBLE_ROUND_ROBIN"
  )
  const [groupBestOf, setGroupBestOf] = useState<string>(String(competition?.groupBestOf ?? 3))
  const [groupPlayAllDuels, setGroupPlayAllDuels] = useState<boolean>(
    competition?.groupPlayAllDuels ?? true
  )
  const [groupTiebreaker1, setGroupTiebreaker1] = useState<string>(
    competition?.groupTiebreaker1 ?? "none"
  )
  const [groupTiebreaker2, setGroupTiebreaker2] = useState<string>(
    competition?.groupTiebreaker2 ?? "none"
  )
  const [groupHasSuddenDeath, setGroupHasSuddenDeath] = useState<boolean>(
    competition?.groupHasSuddenDeath ?? true
  )

  const isBestOfSingle = leagueFormat === "BEST_OF_SINGLE"

  const [name, setName] = useState<string>(competition?.name ?? "")
  const [shotsPerSeries, setShotsPerSeries] = useState<string>(
    String(competition?.shotsPerSeries ?? 10)
  )
  const [disciplineId, setDisciplineId] = useState<string>(competition?.disciplineId ?? "mixed")
  const [minSeries, setMinSeries] = useState<string>(
    competition?.minSeries != null ? String(competition.minSeries) : ""
  )
  const [seasonStart, setSeasonStart] = useState<string>(toDateInputValue(competition?.seasonStart))
  const [seasonEnd, setSeasonEnd] = useState<string>(toDateInputValue(competition?.seasonEnd))
  const [hinrundeDeadline, setHinrundeDeadline] = useState<string>(
    toDateInputValue(competition?.hinrundeDeadline)
  )
  const [rueckrundeDeadline, setRueckrundeDeadline] = useState<string>(
    toDateInputValue(competition?.rueckrundeDeadline)
  )
  const [playoffBestOf, setPlayoffBestOf] = useState<string>(
    String(competition?.playoffBestOf ?? 5)
  )
  const [playoffHasViertelfinale, setPlayoffHasViertelfinale] = useState<boolean>(
    competition?.playoffHasViertelfinale ?? true
  )
  const [playoffHasAchtelfinale, setPlayoffHasAchtelfinale] = useState<boolean>(
    competition?.playoffHasAchtelfinale ?? false
  )
  const [eventDate, setEventDate] = useState<string>(toDateInputValue(competition?.eventDate))
  const [teamScoring, setTeamScoring] = useState<string>(competition?.teamScoring ?? "SUM")
  const [targetValue, setTargetValue] = useState<string>(
    competition?.targetValue != null ? String(competition.targetValue) : ""
  )
  const [targetValueType, setTargetValueType] = useState<string>(
    competition?.targetValueType ?? "RINGS"
  )

  const [isPublic, setIsPublic] = useState<boolean>(competition?.isPublic ?? false)
  const [publicSlug, setPublicSlug] = useState<string>(competition?.publicSlug ?? "")
  const [publicPassword, setPublicPassword] = useState<string>("")
  const [removePublicPassword, setRemovePublicPassword] = useState<boolean>(false)

  const hasExistingPassword = competition?.hasPublicPassword ?? false

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

  // When the user first turns the publish switch on, pre-fill the slug from the name
  // (only if the slug input is currently empty). Subsequent edits are left alone.
  useEffect(() => {
    if (isPublic && publicSlug.trim() === "" && name) {
      setPublicSlug(slugify(name)) // eslint-disable-line react-hooks/set-state-in-effect
    }
  }, [isPublic]) // eslint-disable-line react-hooks/exhaustive-deps

  const fieldErrors =
    state && "error" in state && typeof state.error === "object" ? state.error : null
  const generalError =
    state && "error" in state && typeof state.error === "string" ? state.error : null

  const isTargetMode =
    scoringMode === "TARGET_ABSOLUTE" ||
    scoringMode === "TARGET_UNDER" ||
    scoringMode === "TARGET_OVER"

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
          value={name}
          onChange={(e) => setName(e.target.value)}
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
              isBestOfSingle
                ? BEST_OF_SINGLE_SCORING_MODE_LABELS
                : type === "SEASON" || type === "LEAGUE"
                  ? SEASON_SCORING_MODE_LABELS
                  : EVENT_SCORING_MODE_LABELS
            ).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isBestOfSingle && (
          <p className="text-xs text-muted-foreground">
            Im Best-of-Modus nur Ringteiler, Ringe, Zehntelringe oder Teiler erlaubt.
          </p>
        )}
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
            value={shotsPerSeries}
            onChange={(e) => setShotsPerSeries(e.target.value)}
            disabled={isPending}
          />
        </div>
      )}

      {/* Disziplin */}
      <div className="space-y-2">
        <Label htmlFor="disciplineId">Disziplin</Label>
        <Select
          name="disciplineId"
          value={disciplineId}
          onValueChange={setDisciplineId}
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
              value={minSeries}
              onChange={(e) => setMinSeries(e.target.value)}
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
              value={seasonStart}
              onChange={(e) => setSeasonStart(e.target.value)}
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="seasonEnd">Saisonende (optional)</Label>
            <Input
              id="seasonEnd"
              name="seasonEnd"
              type="date"
              value={seasonEnd}
              onChange={(e) => setSeasonEnd(e.target.value)}
              disabled={isPending}
            />
          </div>
        </>
      )}

      {/* ── Liga-Felder ─────────────────────────────────────────── */}
      {(type === "LEAGUE" || (isEdit && competition?.type === "LEAGUE")) && (
        <>
          {/* Stichtage: nur für Doppelrunde (Hin-/Rückrunde) sinnvoll, nicht für BEST_OF_SINGLE */}
          {!isBestOfSingle && (
            <>
              <div className="space-y-2">
                <Label htmlFor="hinrundeDeadline">Hinrunde-Stichtag (optional)</Label>
                <Input
                  id="hinrundeDeadline"
                  name="hinrundeDeadline"
                  type="date"
                  value={hinrundeDeadline}
                  onChange={(e) => setHinrundeDeadline(e.target.value)}
                  disabled={isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rueckrundeDeadline">Rückrunde-Stichtag (optional)</Label>
                <Input
                  id="rueckrundeDeadline"
                  name="rueckrundeDeadline"
                  type="date"
                  value={rueckrundeDeadline}
                  onChange={(e) => setRueckrundeDeadline(e.target.value)}
                  disabled={isPending}
                />
              </div>
            </>
          )}

          {/* ── Regelset ──────────────────────────────────────────── */}
          <div className="space-y-4 rounded-lg border bg-card p-4">
            <p className="text-sm font-medium">Regelset</p>

            {/* Gruppenphase & Format — gesperrt, sobald Paarungen existieren */}
            <fieldset disabled={hasMatchups || isPending} className="space-y-4">
              {hasMatchups && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Lock className="h-3 w-3" />
                  Gruppenphase &amp; Format gesperrt — Paarungen existieren bereits
                </span>
              )}
              {/* Liga-Format */}
              <div className="space-y-2">
                <Label htmlFor="leagueFormat">Format</Label>
                <Select
                  name="leagueFormat"
                  value={leagueFormat}
                  onValueChange={(v) => {
                    setLeagueFormat(v)
                    // When switching to BEST_OF_SINGLE, reset scoringMode to RINGTEILER
                    // if the current mode is not allowed in head-to-head duels.
                    if (
                      v === "BEST_OF_SINGLE" &&
                      !["RINGS", "RINGS_DECIMAL", "TEILER", "RINGTEILER"].includes(scoringMode)
                    ) {
                      setScoringMode("RINGTEILER")
                    }
                  }}
                >
                  <SelectTrigger id="leagueFormat">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DOUBLE_ROUND_ROBIN">Doppelrunde (Hin/Rück)</SelectItem>
                    <SelectItem value="BEST_OF_SINGLE">
                      Best-of-Begegnung (einfache Runde)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* BEST_OF_SINGLE group-phase fields */}
              {isBestOfSingle && (
                <div className="space-y-4 rounded-lg border bg-card p-4">
                  <p className="text-sm font-medium">Gruppenphase (Best-of)</p>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="groupBestOf">Best-of</Label>
                      <Select name="groupBestOf" value={groupBestOf} onValueChange={setGroupBestOf}>
                        <SelectTrigger id="groupBestOf">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="3">Best-of-3 (2 Siege)</SelectItem>
                          <SelectItem value="5">Best-of-5 (3 Siege)</SelectItem>
                          <SelectItem value="7">Best-of-7 (4 Siege)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-end pb-1">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="groupPlayAllDuels"
                          checked={groupPlayAllDuels}
                          onCheckedChange={(checked: boolean | "indeterminate") =>
                            setGroupPlayAllDuels(checked === true)
                          }
                        />
                        <Label htmlFor="groupPlayAllDuels" className="cursor-pointer">
                          Alle Duelle ausspielen
                        </Label>
                      </div>
                    </div>
                  </div>
                  <input
                    type="hidden"
                    name="groupPlayAllDuels"
                    value={groupPlayAllDuels ? "true" : "false"}
                  />

                  {/* Advanced / Tiebreaker area */}
                  <details>
                    <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                      Erweitert (Tiebreaker &amp; Stechschuss)
                    </summary>
                    <div className="mt-3 space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="groupTiebreaker1">Tiebreaker 1</Label>
                        <Select
                          name="groupTiebreaker1"
                          value={groupTiebreaker1}
                          onValueChange={(v) => {
                            setGroupTiebreaker1(v)
                            if (v === "none") setGroupTiebreaker2("none")
                          }}
                        >
                          <SelectTrigger id="groupTiebreaker1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">— Kein Tiebreaker</SelectItem>
                            {Object.entries(BEST_OF_SINGLE_SCORING_MODE_LABELS).map(
                              ([value, label]) => (
                                <SelectItem key={value} value={value}>
                                  {label}
                                </SelectItem>
                              )
                            )}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Bei Gleichstand nach Gruppenphase (optional).
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="groupTiebreaker2">Tiebreaker 2</Label>
                        <Select
                          name="groupTiebreaker2"
                          value={groupTiebreaker2}
                          onValueChange={setGroupTiebreaker2}
                          disabled={groupTiebreaker1 === "none"}
                        >
                          <SelectTrigger id="groupTiebreaker2">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">— Kein Tiebreaker</SelectItem>
                            {Object.entries(BEST_OF_SINGLE_SCORING_MODE_LABELS).map(
                              ([value, label]) => (
                                <SelectItem key={value} value={value}>
                                  {label}
                                </SelectItem>
                              )
                            )}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Bei Gleichstand nach Tiebreaker 1 (nur wenn TB1 gesetzt).
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="groupHasSuddenDeath"
                          checked={groupHasSuddenDeath}
                          onCheckedChange={(checked: boolean | "indeterminate") =>
                            setGroupHasSuddenDeath(checked === true)
                          }
                        />
                        <Label htmlFor="groupHasSuddenDeath" className="cursor-pointer">
                          Gleichstand per Stechschuss
                        </Label>
                      </div>
                      <input
                        type="hidden"
                        name="groupHasSuddenDeath"
                        value={groupHasSuddenDeath ? "true" : "false"}
                      />
                    </div>
                  </details>
                </div>
              )}
              {/* Schuss/Serie (Gruppenphase): nur klassische Liga (BEST_OF_SINGLE immer 10) */}
              {!isBestOfSingle && (
                <div className="space-y-2">
                  <Label htmlFor="shotsPerSeriesLeague">Schuss/Serie</Label>
                  <Input
                    id="shotsPerSeriesLeague"
                    name="shotsPerSeries"
                    type="number"
                    min={1}
                    max={100}
                    value={shotsPerSeries}
                    onChange={(e) => setShotsPerSeries(e.target.value)}
                  />
                </div>
              )}
              {isBestOfSingle && <input type="hidden" name="shotsPerSeries" value="10" />}
            </fieldset>

            {/* Playoffs & Finale — editierbar, bis die Playoffs gestartet sind */}
            <fieldset disabled={playoffsStarted || isPending} className="space-y-4 border-t pt-4">
              {playoffsStarted && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Lock className="h-3 w-3" />
                  Playoffs gesperrt — bereits gestartet
                </span>
              )}
              <div className="space-y-2">
                <Label htmlFor="playoffBestOf">Finale/Halbfinale – Best-of</Label>
                <Select name="playoffBestOf" value={playoffBestOf} onValueChange={setPlayoffBestOf}>
                  <SelectTrigger id="playoffBestOf">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">Best-of-3 (2 Siege)</SelectItem>
                    <SelectItem value="5">Best-of-5 (3 Siege)</SelectItem>
                    <SelectItem value="7">Best-of-7 (4 Siege)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <input
                    id="playoffHasViertelfinale"
                    name="playoffHasViertelfinale"
                    type="checkbox"
                    value="true"
                    checked={playoffHasViertelfinale}
                    onChange={(e) => setPlayoffHasViertelfinale(e.target.checked)}
                  />
                  <Label htmlFor="playoffHasViertelfinale">Viertelfinale (8 TN)</Label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="playoffHasAchtelfinale"
                    name="playoffHasAchtelfinale"
                    type="checkbox"
                    value="true"
                    checked={playoffHasAchtelfinale}
                    onChange={(e) => setPlayoffHasAchtelfinale(e.target.checked)}
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
                  Finale: Gleichstand per Stechschuss
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
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
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
                value={teamScoring}
                onValueChange={setTeamScoring}
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
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  placeholder="z.B. 512"
                  disabled={isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="targetValueType">Zielwert-Typ</Label>
                <Select
                  name="targetValueType"
                  value={targetValueType}
                  onValueChange={setTargetValueType}
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

      {/* Veröffentlichung */}
      <div className="space-y-4 rounded-lg border bg-card p-4">
        <div className="flex items-start gap-3">
          <Checkbox
            id="isPublic"
            name="isPublic"
            checked={isPublic}
            onCheckedChange={(v) => setIsPublic(v === true)}
            disabled={isPending}
          />
          <div className="space-y-1">
            <Label htmlFor="isPublic">Auf Vereins-Website veröffentlichen</Label>
            <p className="text-sm text-muted-foreground">
              Stellt das Haupt-PDF dieses Wettbewerbs unter einer öffentlichen URL bereit.
            </p>
          </div>
        </div>

        {isPublic && (
          <div className="space-y-4 pl-7">
            <div className="space-y-2">
              <Label htmlFor="publicSlug">Slug</Label>
              <Input
                id="publicSlug"
                name="publicSlug"
                value={publicSlug}
                onChange={(e) => setPublicSlug(e.target.value)}
                placeholder="z.B. jahrespreisschiessen"
                maxLength={60}
                disabled={isPending}
              />
              <p className="text-xs text-muted-foreground">
                URL: <code className="text-xs">/api/public/c/{publicSlug || "<slug>"}/pdf</code>
              </p>
              {publicSlug && !SLUG_REGEX.test(publicSlug) && (
                <p className="text-xs text-destructive">
                  Slug: 3–60 Zeichen, nur a–z, 0–9 und Bindestriche, keine doppelten Bindestriche.
                </p>
              )}
              {isEdit && competition?.publicSlug && competition.publicSlug !== publicSlug && (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Hinweis: Die bestehende öffentliche URL (/api/public/c/
                  {competition.publicSlug}/pdf) wird ungültig.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="publicPassword">Passwort (optional)</Label>
              <Input
                id="publicPassword"
                name="publicPassword"
                type="password"
                value={publicPassword}
                onChange={(e) => setPublicPassword(e.target.value)}
                placeholder={hasExistingPassword ? "●●●●●●●●" : ""}
                autoComplete="new-password"
                disabled={isPending || removePublicPassword}
              />
              <p className="text-xs text-muted-foreground">
                {hasExistingPassword
                  ? "Passwort ist gesetzt. Leer lassen, um es beizubehalten."
                  : "Optional — leer lassen für ungeschützten Zugriff. Mindestens 4 Zeichen."}
              </p>
              {publicPassword && publicPassword.length < 4 && (
                <p className="text-xs text-destructive">
                  Passwort muss mindestens 4 Zeichen haben.
                </p>
              )}
              {hasExistingPassword && (
                <div className="flex items-center gap-2 pt-1">
                  <Checkbox
                    id="removePublicPassword"
                    name="removePublicPassword"
                    checked={removePublicPassword}
                    onCheckedChange={(v) => setRemovePublicPassword(v === true)}
                    disabled={isPending}
                  />
                  <Label htmlFor="removePublicPassword" className="text-sm font-normal">
                    Passwort entfernen
                  </Label>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

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

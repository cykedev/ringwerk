# Aufgaben-Log – Ringwerk

---

## Aktuell

### Ringwerk-Umbau: Uebersicht

Iterativer Umbau von "1-gegen-1 Liga-App" zu "Ringwerk" — universelle Wettbewerbs-Plattform.
6 Phasen, jede Phase eigenstaendig lieferbar. Detaillierte Anforderungen in `features.md` und `data-model.md`.

**Voraussetzung:** App ist pre-launch, kein Migrationsdruck, aggressive Refactorings erlaubt.

---

### Phase 1: Fundament (Rename + Disziplin-Faktor)

**Ziel:** App heisst "Ringwerk", Disziplinen haben einen Teiler-Faktor, neue Enums vorbereitet.
**Abhaengigkeiten:** Keine.
**Risiko:** Gering — additive Aenderungen, kein bestehendes Feature bricht.
**Status:** ABGESCHLOSSEN [2026-03-16]

#### Schema & Migration

- [x] `prisma/schema.prisma` — `Discipline` um `teilerFaktor Decimal @default(1.0)` erweitern
- [x] `prisma/schema.prisma` — Neue Enums anlegen: `CompetitionType`, `ScoringMode`, `TargetValueType` (noch nicht referenziert, aber fuer Phase 2 vorbereitet)
- [x] `/migrate add-discipline-teiler-faktor`

#### Types & Queries

- [x] `src/lib/disciplines/types.ts` — `teilerFaktor` in `DisciplineListItem` und `DisciplineDetail` aufnehmen
- [x] `src/lib/disciplines/queries.ts` — `teilerFaktor` in alle Select-Bloecke

#### Actions

- [x] `src/lib/disciplines/actions.ts` — Zod-Schema fuer create/update um `teilerFaktor` erweitern (Decimal, min 0.001)
- [x] `src/lib/disciplines/systemDisciplines.ts` — Default-Faktoren: LP=0.333, LG=1.0, LPA=0.6, LGA=1.8

#### Components & Pages

- [x] `src/components/app/disciplines/DisciplineForm.tsx` — Faktor-Feld (Number-Input, Label "Teiler-Faktor", Hilfstext mit Erklaerung)
- [x] `src/app/(app)/disciplines/page.tsx` — Faktor in der Disziplin-Liste anzeigen

#### Rename

- [x] `package.json` — name: "ringwerk"
- [x] Navigation/Shell — "Ringwerk" statt "1gegen1" im UI
- [x] `<title>` und Meta-Tags anpassen
- [x] README.md — Projekttitel aktualisieren

#### Tests & Qualitaet

- [x] Bestehende Discipline-Tests anpassen (neues Feld)
- [x] `/check` — alle Gates gruen

#### Finalisierung

- [x] `docs/` — Aenderungen dokumentieren

---

### Phase 2: Competition-Abstraktion

**Ziel:** League → Competition verallgemeinern. Liga funktioniert danach exakt wie vorher, nur unter neuem Dach.
**Abhaengigkeiten:** Phase 1 abgeschlossen.
**Status:** ABGESCHLOSSEN [2026-03-16]

#### Schema & Migration

- [x] `prisma/schema.prisma` — `League` zu `Competition` umbenennen
- [x] `prisma/schema.prisma` — `type CompetitionType` Feld hinzufuegen (default LEAGUE)
- [x] `prisma/schema.prisma` — `LeagueParticipant` zu `CompetitionParticipant` umbenennen
- [x] `prisma/schema.prisma` — `CompetitionParticipant` um `disciplineId String?` und `isGuest Boolean @default(false)` erweitern
- [x] `prisma/schema.prisma` — Shared Felder auf Competition: `scoringMode`, `shotsPerSeries`, `disciplineId?`
- [x] `prisma/schema.prisma` — Liga-spezifische Felder (nullable): playoff-Config, Stichtage, finaleScoringMode, finaleHasSuddenDeath
- [x] `prisma/schema.prisma` — Event-spezifische Felder (nullable): eventDate, allowGuests, teamSize, targetValue, targetValueType
- [x] `prisma/schema.prisma` — Saison-spezifische Felder (nullable): minSeries, seasonStart, seasonEnd
- [x] `prisma/schema.prisma` — AuditLog: `leagueId` → `competitionId`
- [x] Manuelle Rename-Migration (`20260316180000_rename_league_to_competition`)

#### Types

- [x] `src/lib/leagues/types.ts` → `src/lib/competitions/types.ts`
- [x] `src/lib/leagueParticipants/types.ts` → `src/lib/competitionParticipants/types.ts`
- [x] Alle Imports in der gesamten Codebase aktualisiert

#### Queries

- [x] `src/lib/leagues/queries.ts` → `src/lib/competitions/queries.ts`
- [x] `src/lib/leagueParticipants/queries.ts` → `src/lib/competitionParticipants/queries.ts`
- [x] Alle Nested Selects in verwandten Modulen (Matchups, Results, Playoffs, AuditLog)

#### Actions

- [x] `src/lib/leagues/actions.ts` → `src/lib/competitions/actions.ts`
- [x] `src/lib/leagueParticipants/actions.ts` → `src/lib/competitionParticipants/actions.ts`
- [x] Force-Delete: `leagueId` → `competitionId` in Kaskade

#### Components

- [x] `src/components/app/leagues/` → `src/components/app/competitions/`
- [x] `src/components/app/leagueParticipants/` → `src/components/app/competitionParticipants/`
- [x] Alle internen Referenzen (Props, Imports) aktualisiert

#### Pages & Routes

- [x] `src/app/(app)/leagues/` → `src/app/(app)/competitions/` (alle Unterseiten)
- [x] Navigation: "Wettbewerbe", href="/competitions"
- [x] PDF-Routen: `api/leagues/` → `api/competitions/`

#### Tests & Qualitaet

- [x] Alle Tests auf neue Pfade/Namen migriert
- [x] `/check` — alle Gates gruen (lint, format, test, typecheck)

#### Finalisierung

- [x] `docs/architecture.md` — Routen + Verzeichnisstruktur aktualisiert
- [x] `docs/` — Alle Referenzen League → Competition

---

### Phase 3: Universelle Scoring-Engine + Serie

**Ziel:** MatchResult → Series. Eine Scoring-Engine fuer alle 7 Wertungsmodi. Faktor-Korrektur integriert.
**Abhaengigkeiten:** Phase 2 abgeschlossen.
**Risiko:** MITTEL — Berechnungslogik aendert sich, aber gut testbar (Pure Functions).
**Status:** ABGESCHLOSSEN [2026-03-17]

#### Schema & Migration

- [x] `prisma/schema.prisma` — `MatchResult` zu `Series` umbenennen; Relationen in `User`, `Participant`, `Matchup` anpassen
- [x] `prisma/schema.prisma` — `totalRings` → `rings` umbenennen
- [x] `prisma/schema.prisma` — `Series` erweitern: `disciplineId`, `shotCount`, `sessionDate`
- [x] `prisma/schema.prisma` — `matchupId String?` nullable
- [x] `prisma/schema.prisma` — `teilerFaktor Decimal(9,7)` (Praezisions-Fix: 7 Nachkommastellen)
- [x] Manuelle Migration `rename-matchresult-to-series` mit Backfill
- [x] Migration `teilerFaktor_precision` (Decimal(4,3) → Decimal(9,7))

#### Scoring-Engine (neues Modul)

- [x] `src/lib/scoring/types.ts` — ScoringMode, ScoreInput, RankableEntry, RankedEntry
- [x] `src/lib/scoring/calculateScore.ts` — alle 7 Modi + `calculateRingteiler` mit 1dp-Rundung
- [x] `src/lib/scoring/rankParticipants.ts` — `rankByScore` mit TARGET_UNDER-Zweistufenranking
- [x] `src/lib/scoring/calculateScore.test.ts` — 26 Tests
- [x] `src/lib/scoring/rankParticipants.test.ts` — 12 Tests

#### Bestehende Logik migrieren

- [x] `src/lib/results/calculateResult.ts` — nutzt Scoring-Engine; `determineOutcome` mit `scoringMode`-Parameter
- [x] `src/lib/standings/calculateStandings.ts` — `rings` statt `totalRings`
- [x] `src/lib/results/calculateResult.test.ts` — Tests angepasst
- [x] `src/lib/standings/calculateStandings.test.ts` — Tests angepasst

#### Queries & Actions

- [x] `src/lib/results/actions.ts` — Series, teilerFaktor aktiv angewendet
- [x] `src/lib/matchups/queries.ts` — Series statt MatchResult
- [x] `src/lib/standings/queries.ts` — Series statt MatchResult
- [x] `src/lib/competitions/actions.ts` — series.deleteMany

#### Components

- [x] `ScheduleView.tsx`, `ResultEntryDialog.tsx`, `SchedulePdf.tsx` — rings statt totalRings

#### Tests & Qualitaet

- [x] 157 Tests gruen
- [x] `/check` — alle Gates gruen

#### Finalisierung

- [x] `docs/data-model.md`, `docs/features.md`, `docs/architecture.md` aktualisiert
- [x] `systemDisciplines.ts` — LP-Faktor 0.333 → 0.3333333

---

### Phase 4: Event-Modus (Kranzlschiessen) ✓ ABGESCHLOSSEN [2026-03-17]

**Ziel:** Erster neuer Wettbewerbstyp voll funktional. Erstellen, Teilnehmer einschreiben, Serien erfassen, Rangliste anzeigen.
**Abhaengigkeiten:** Phase 3 abgeschlossen (Scoring-Engine + Serie).
**Risiko:** GERING — neuer Code, kein Refactoring. Nutzt die universelle Scoring-Engine.
**Status:** ABGESCHLOSSEN [2026-03-17]

#### Types

- [x] `src/lib/competitions/types.ts` — Event-spezifische Typen: `EventDetail`, `EventConfig`
- [x] `src/lib/series/types.ts` (neues Modul) — `EventSeriesItem`, `SaveEventSeriesInput`

#### Queries

- [x] `src/lib/competitions/queries.ts` — Event-spezifische Abfragen (getEventWithSeries)

#### Actions

- [x] `src/lib/competitions/actions.ts` — Event-Erstellung mit type + scoringMode + disciplineId + allowGuests
- [x] `src/lib/series/actions.ts` (neues Modul) — `saveEventSeries`, `deleteEventSeries`

#### Calculate

- [x] `src/lib/scoring/rankEventParticipants.ts` — Event-Ranking mit Faktor-Korrektur
- [x] Faktor-Korrektur bei gemischten Disziplinen
- [x] TARGET-Modi vollständig in Scoring-Engine (Phase 3)

#### Components

- [x] CompetitionForm — Event-Felder (type selector, allowGuests, disciplineId, scoring)
- [x] EnrollParticipantForm — isGuest + disciplineId Support
- [x] EventSeriesDialog — Serie hinzufügen/bearbeiten
- [x] EventRankingTable — Rangliste mit Disziplin-Anzeige + Faktor
- [x] DeleteEventSeriesButton — Serie löschen
- [x] checkbox.tsx — shadcn/ui Component
- [x] competitions/page.tsx — Type-Badges, Event-Links

#### Pages

- [x] `/competitions/[id]/page.tsx` — Type-basierter Redirect
- [x] `/competitions/[id]/series` — Serien-Erfassung für Events
- [x] `/competitions/[id]/ranking` — Event-Rangliste

#### Tests & Qualitaet

- [x] Scoring-Engine Events mit allen 7 Modi getestet
- [x] TARGET_UNDER Ranking Tests
- [x] `/check` — alle Gates grün

#### Finalisierung

- [x] `docs/architecture.md` — Routen, lib-modules, components aktualisiert
- [x] `docs/features.md` — Event-Phase als implementiert markiert

---

### Phase 5: Saison-Modus (Jahrespreisschiessen) ✓ ABGESCHLOSSEN [2026-03-17]

**Ziel:** Langzeit-Wettbewerb mit Mehrfach-Wertung. Serien ueber Monate erfassen, Best-of-Logik, Mindestserien.
**Abhaengigkeiten:** Phase 4 abgeschlossen (Event-Modus, Series-Infrastruktur).
**Risiko:** GERING — neuer Code. Komplexitaet liegt in der Best-of-Auswertung (gut testbar).
**Status:** ABGESCHLOSSEN [2026-03-17]

#### Types

- [x] `src/lib/series/types.ts` — `SeasonSeriesItem`, `SeasonParticipantEntry`

#### Queries

- [x] `src/lib/competitions/queries.ts` — `getSeasonWithSeries`

#### Actions

- [x] `src/lib/series/actions.ts` — `saveSeasonSeries`, `deleteSeasonSeries`
- [x] `src/lib/competitions/actions.ts` — Season-Felder in `createCompetition`/`updateCompetition` (minSeries, seasonStart, seasonEnd)
- [x] `src/lib/auditLog/types.ts` — `SEASON_SERIES_ENTERED`, `SEASON_SERIES_DELETED`

#### Calculate

- [x] `src/lib/scoring/calculateSeasonStandings.ts` — 3 unabhaengige Wertungen, Mindestserien-Filter, Rang-Zuweisung
- [x] `src/lib/scoring/calculateSeasonStandings.test.ts` — 13 Tests

#### Components

- [x] `CompetitionForm.tsx` — SEASON-Option + Saison-Felder (minSeries, seasonStart, seasonEnd)
- [x] `SeasonSeriesDialog.tsx` — Serie hinzufuegen (Datum + Ringe + Teiler + optionale Disziplin)
- [x] `SeasonStandingsTable.tsx` — 3 Spalten (beste Ringe, bester Teiler, bester Ringteiler) + Fortschritt
- [x] `DeleteSeasonSeriesButton.tsx` — AlertDialog fuer Serienloeschung

#### Pages

- [x] `/competitions/[id]/page.tsx` — SEASON-Redirect zu `/standings`
- [x] `/competitions/[id]/series` — Season-Branch: Teilnehmer-Liste mit Serien + Add/Delete
- [x] `/competitions/[id]/standings` — Saison-Rangliste (3-Spalten-Tabelle)

#### Tests & Qualitaet

- [x] 179 Tests gruen
- [x] `/check` — alle Gates gruen

#### Finalisierung

- [x] `docs/` aktualisiert

---

### Phase 6: Liga-Ausbau (Konfigurierbare Regelsets) ✓ ABGESCHLOSSEN [2026-03-18]

**Ziel:** Volles konfigurierbares Regelset fuer Ligen innerhalb des Competition-Rahmens.
**Abhaengigkeiten:** Phase 2 abgeschlossen (Competition-Abstraktion). Kann parallel zu Phase 4/5.
**Risiko:** MITTEL — viele Breaking Points in bestehender Liga-Logik. Bereits detailliert geplant.

Hinweis: Die Felder sind in Phase 2 bereits im Schema angelegt (nullable mit Defaults).
Phase 6 implementiert die Logik und UI dafuer.

#### Actions

- [x] `src/lib/competitions/actions.ts` — Zod-Schema um Regelset-Felder erweitern + Lock-Logik (wenn Matchups existieren → Regelset gesperrt)
- [x] `src/lib/results/actions.ts` — `scoringMode` aus Competition laden + an `determineOutcome()` uebergeben
- [x] `src/lib/playoffs/actions.ts` — `playoffBestOf`, `playoffQualThreshold`, `finaleScoringMode`, `finaleHasSuddenDeath` aus Competition laden + verwenden

#### Calculate

- [x] `src/lib/results/calculateResult.ts` — `determineOutcome()` um `scoringMode` Parameter erweitern
- [x] `src/lib/playoffs/calculatePlayoffs.ts`:
  - `isPlayoffMatchComplete(match, requiredWins)` — hardkodierte 3 durch Parameter
  - `createFirstRoundMatchups(standings, ruleset)` — Qual-Parameter
  - Finale: `finaleScoringMode` nutzen
- [x] `src/lib/standings/calculateStandings.ts` — `scoringMode` durchreichen; Sortierung bei RINGS umkehren

#### Components

- [x] Competition-Formular — "Regelset"-Sektion mit `<fieldset disabled={hasMatchups}>` + Sperrhinweis
- [x] `PlayoffMatchCard.tsx` — dynamische Labels (Best-of-N, Schusszahl)
- [x] `PlayoffDuelResultDialog.tsx` — Titel mit `shotsPerSeries`
- [x] `ScheduleView.tsx` — `scoringMode` fuer Ergebnis-Farbmarkierung

#### Tests & Qualitaet

- [x] `calculateResult.test.ts` — neuer Parameter + RINGS-Modus Tests
- [x] `calculatePlayoffs.test.ts` — parametrisierte Tests (bestOf, qualThreshold)
- [x] `calculateStandings.test.ts` — scoringMode-Parameter
- [x] `/check` — alle Gates gruen

#### Finalisierung

- [x] `docs/` — Regelset dokumentieren

---

---

### Playoff-Achtelfinale (EIGHTH_FINAL) [2026-03-18]

**Ziel:** Playoff-Konfiguration auf zwei Boolean-Flags umstellen (`playoffHasViertelfinale`, `playoffHasAchtelfinale`). EIGHTH_FINAL-Runde implementieren, Bracket auf 4 Spalten erweitern.
**Status:** Implementiert, Commit ausstehend.

#### Schema & Migration

- [x] `playoffQualTopN1`, `playoffQualTopN2`, `playoffQualThreshold` entfernt
- [x] `playoffHasViertelfinale Boolean @default(true)`, `playoffHasAchtelfinale Boolean @default(false)` hinzugefügt
- [x] `PlayoffRound` Enum um `EIGHTH_FINAL` erweitert
- [x] Migration `playoff-boolean-rounds`

#### Core

- [x] `calculatePlayoffs.ts` — `getNextRound()`, `createFirstRoundMatchups()` (3 Pfade: AF/VF/HF), `createNextRoundMatchups()` generalisiert
- [x] `calculatePlayoffs.test.ts` — Boolean-basierte Tests inkl. EIGHTH_FINAL

#### Types / Queries / Actions

- [x] `competitions/types.ts` — TopN-Felder raus, boolean flags rein
- [x] `competitions/queries.ts` — Select aktualisiert
- [x] `competitions/actions.ts` — Zod-Schema, Lock-Logik, `.nullable()` für Boolean-Checkboxen
- [x] `playoffs/types.ts` — `eighthFinals: PlayoffMatchItem[]` in `PlayoffBracketData`
- [x] `playoffs/queries.ts` — eighthFinals in Abfrage
- [x] `playoffs/actions.ts` — `getNextRound()` überall genutzt, `startPlayoffs` mit dynamischem `minRequired`
- [x] `auditLog/types.ts` — `EIGHTH_FINAL: "Achtelfinale"`

#### UI / Bracket / PDF

- [x] `CompetitionForm.tsx` — Checkboxen statt TopN-Inputs
- [x] `PlayoffMatchCard.tsx` — `EIGHTH_FINAL` in `ROUND_LABEL` und `WINNER_BADGE`
- [x] `PlayoffBracket.tsx` — 4-Spalten-Layout (AF + VF + HF + F), Geometrie-Berechnung
- [x] `PlayoffsPdf.tsx` — AF-Spalte, Connector-Overlay, Detailabschnitt
- [x] `playoffs/page.tsx` — `playoffsStarted`, `advanceLabel`, `canStart`/`disabledReason`, Infotext dynamisch
- [x] `pdf/playoffs/route.ts` — `playoffsStarted` mit eighthFinals

#### Qualität

- [x] `/check` — alle Gates grün (203 Tests)
- [ ] Commit erstellen

---

### Refactor: Finale-Scoring-Konfiguration — GEPLANT

**Ziel:** `finaleScoringMode: ScoringMode | null` durch drei explizite Felder ersetzen. Kein impliziertes Verhalten mehr — jedes Kriterium klar und unabhängig konfigurierbar.

**Neues Datenmodell:**

| Feld                   | Typ           | Default | Nullable            |
| ---------------------- | ------------- | ------- | ------------------- |
| `finalePrimary`        | `ScoringMode` | `RINGS` | Nein                |
| `finaleTiebreaker1`    | `ScoringMode` | —       | Ja                  |
| `finaleTiebreaker2`    | `ScoringMode` | —       | Ja                  |
| `finaleHasSuddenDeath` | Boolean       | `true`  | Nein (unveraendert) |

Gueltige Werte: `RINGS`, `RINGS_DECIMAL`, `RINGTEILER`, `TEILER`.
Validierungsregel: `finaleTiebreaker2` darf nur gesetzt sein wenn `finaleTiebreaker1` gesetzt ist.
`finaleNeedsTeiler` = true wenn irgendein Kriterium `RINGTEILER` oder `TEILER` ist.

#### Schema & Migration

- [ ] `prisma/schema.prisma` — `finaleScoringMode ScoringMode?` entfernen
- [ ] `prisma/schema.prisma` — `finalePrimary ScoringMode @default(RINGS)` hinzufuegen
- [ ] `prisma/schema.prisma` — `finaleTiebreaker1 ScoringMode?` hinzufuegen
- [ ] `prisma/schema.prisma` — `finaleTiebreaker2 ScoringMode?` hinzufuegen
- [ ] `/migrate finale-scoring-refactor` — inkl. Datenmigration: `finaleScoringMode` → `finalePrimary` (NULL → RINGS)

#### Calculate (`calculatePlayoffs.ts`)

- [ ] `PlayoffRuleset` — `finaleScoringMode` ersetzen durch `finalePrimary`, `finaleTiebreaker1`, `finaleTiebreaker2`
- [ ] `finaleNeedsTeiler(primary, tb1, tb2)` — true wenn any === "RINGTEILER" || "TEILER"
- [ ] `compareByFinale(criterion, ringsA, ringsB, teilerA?, ringteilerA?, teilerB?, ringteilerB?)` — interner Helfer
- [ ] `determineFinaleRoundWinner(...)` — Kette: primary → tb1 → tb2 → DRAW; Signatur anpassen

#### Types / Queries / Actions

- [ ] `competitions/types.ts` — `CompetitionDetail`: `finaleScoringMode` durch 3 Felder ersetzen
- [ ] `competitions/queries.ts` — Select: `finaleScoringMode` durch 3 Felder ersetzen
- [ ] `competitions/actions.ts` — Zod `BaseSchema`:
  - `finaleScoringMode` entfernen
  - `finalePrimary: z.enum(FINALE_CRITERIA).default("RINGS")`
  - `finaleTiebreaker1: z.preprocess(...nullable)`, `finaleTiebreaker2: z.preprocess(...nullable)`
  - `.refine()`: tb2 gesetzt ohne tb1 → Fehler "Tiebreaker 2 setzt Tiebreaker 1 voraus"
  - Create/Update-Mapping aktualisieren
- [ ] `playoffs/actions.ts` — Select und alle Aufrufe von `determineFinaleRoundWinner` / `finaleNeedsTeiler` anpassen

#### Components

- [ ] `CompetitionForm.tsx` — `finaleScoringMode`-Select ersetzen durch:
  - `finalePrimary` (required, default RINGS, beschriftet "Hauptkriterium")
  - `finaleTiebreaker1` (optional, "Kein Tiebreaker" als Default-Option)
  - `finaleTiebreaker2` (optional, disabled wenn tb1 nicht gesetzt)
  - Erklaerungstext je Feld (was bedeutet das Kriterium)
- [ ] `PlayoffDuelResultDialog.tsx` — Prop `finaleScoringMode` durch 3 Felder ersetzen; `finaleNeedsTeiler`-Aufruf anpassen
- [ ] `PlayoffMatchCard.tsx` — Prop ersetzen; Hinweistext zeigt Kriterienkette an (z.B. "Primär: Ringe · TB: Teiler")
- [ ] `PlayoffBracket.tsx` — Props durchreichen (3 statt 1 Feld)
- [ ] `playoffs/page.tsx` — 3 Felder aus `competition` an `PlayoffBracket` weitergeben

#### Tests

- [ ] `calculatePlayoffs.test.ts` — neue Tests fuer `determineFinaleRoundWinner`:
  - Alle Kombinationen: primary only, primary + tb1, primary + tb1 + tb2
  - Kriterien: RINGS, RINGTEILER, TEILER, RINGS_DECIMAL
  - `finaleNeedsTeiler` mit verschiedenen Konfigurationen
- [ ] `competitions/actions.test.ts` — neue Felder + Validierungsregel tb2-ohne-tb1

#### Qualitaet & Finalisierung

- [ ] `/check` — alle Gates gruen
- [ ] `docs/features.md` — Finale-Scoring-Abschnitt aktualisieren
- [ ] Commit

---

## Abgeschlossen

### [2026-03-18] Phase 6: Liga-Ausbau (Konfigurierbare Regelsets)

**Status:** Implementiert und dokumentiert. Alle Regelset-Felder funktional, Lock-Logik aktiv, Scoring-Engine integriert.

- [x] 6 neue Liga-spezifische Felder im Schema (Phase 2 vorbereitet, Phase 6 aktiviert)
- [x] Zod-Validierung + Lock-Logik bei bestehenden Matchups
- [x] `scoringMode` integriert in Standings-Sortierung und MatchResult-Auswertung (bestOf, Qual-Parameter, Finale-Scoring)
- [x] `determineOutcome()` mit dynamischer Wertung (RINGS, RINGS_DECIMAL, TEILER, RINGTEILER)
- [x] `bestRings` zur StandingsRow hinzugefügt
- [x] Dynamische Labels in PlayoffMatchCard/PlayoffDuelResultDialog basierend auf Regelset
- [x] finaleNeedsTeiler + requiredWinsFromBestOf parametrisiert
- [x] Features.md dokumentiert (Liga-Sektion: Konfiguration, Regelsets, Playoff-Parameter)
- [x] Docs-Sync durchgeführt

---

### [2026-03-16] Ringwerk-Planung

- [x] Konzeptionelle Diskussion: 3 Wettbewerbstypen (Liga, Event, Saison) definiert
- [x] 7 Wertungsmodi definiert (inkl. Zielwert-Modi)
- [x] Teiler-Faktor-Konzept geklaert (ein Faktor pro Disziplin)
- [x] Name "Ringwerk" gewaehlt
- [x] Iterationsplan (6 Phasen) erstellt
- [x] Dokumentation aktualisiert: project-brief.md, features.md, data-model.md, todo.md

---

### [2026-03-12] Feature: Konfigurierbare Regelsets pro Liga

**Status:** Geplant, nicht implementiert. → Aufgegangen in Phase 6 des Ringwerk-Umbaus.

---

### [2026-03-10] Feature: Liga endgültig löschen (Force Delete)

- [x] `src/lib/leagues/actions.ts` – `forceDeleteLeague()` Server Action (Auth → Name-Bestätigung → transaktionale Kaskadenlöschung)
- [x] `src/components/app/leagues/ForceDeleteLeagueSection.tsx` – Gefahrenzone-Sektion mit AlertDialog und Name-Eingabe
- [x] `src/app/(app)/leagues/[id]/edit/page.tsx` – `ForceDeleteLeagueSection` eingebunden
- [x] `src/lib/leagues/actions.test.ts` – 7 neue Tests für `forceDeleteLeague`
- [x] `docs/features.md` – Abschnitt „Liga endgültig löschen" ergänzt
- [x] `docs/architecture.md` – `actions.ts`-Beschreibung aktualisiert

---

### [2026-03-10] Mobile-Optimierung: Playoffs-Seite

- [x] `PlayoffMatchCard.tsx` – `CardHeader` / `CardContent` Padding: `px-6` → `px-4 sm:px-6`
- [x] `PlayoffMatchCard.tsx` – Duell-Zeilen: `px-3` → `px-2 sm:px-3`
- [x] `PlayoffMatchCard.tsx` – „ausstehend"-Placeholder-Text entfernt
- [x] `PlayoffBracket.tsx` – Finale-Karte: `max-w-xs mx-auto sm:max-w-sm`
- [x] `PlayoffDuelResultDialog.tsx` – „Eintragen"-Button icon-only auf Mobile
- [x] `/check` grün

---

### [2026-03-10] Refactor: Automatisches Duell bei VF/HF-Unentschieden

- [x] `addSuddenDeathDuel` generalisiert zu `addExtraDuel(id, isSuddenDeath)`
- [x] Bei VF/HF-Unentschieden: nächstes Duell automatisch angelegt
- [x] Hard-Limit von 5 Duellen pro Match entfernt

---

### [2026-03-09] Feature: Playoff-Phase

- [x] Vollständige Playoff-Implementierung (Types, Calculate, Queries, Actions, Components, Pages)
- [x] 22 Tests, `/check` grün

---

### [2026-03-09] Feature: Ergebniserfassung + Tabelle

- [x] Vollständige Implementierung (ResultEntryDialog, ScheduleView, StandingsTable)
- [x] 83 Tests, `/check` grün

---

### [2026-03-09] Feature: Spielplan-Generierung

- [x] Round-Robin mit Circle-Method, Hin-/Rückrunde, Freilos
- [x] 59 Tests, `/check` grün

---

### [2026-03-09] Feature: Teilnehmer

- [x] CRUD, Einschreibung, Rückzug, Startnummer
- [x] `/check` grün

---

### [2026-03-09] Projektinitialisierung + Tech Stack + Disziplinen + Nutzerverwaltung + Ligen + Datum

- [x] Komplettes Basis-Setup: Next.js 16, Prisma 7, Auth, Docker, shadcn/ui
- [x] Alle Basis-Features implementiert

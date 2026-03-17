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

#### Schema & Migration

- [ ] `prisma/schema.prisma` — `MatchResult` zu `Series` umbenennen
- [ ] `prisma/schema.prisma` — `Series` erweitern: `disciplineId String (FK)`, `shotCount Int`, `sessionDate DateTime`, `matchupId String? (FK, optional)`
- [ ] `prisma/schema.prisma` — `totalRings` → `rings`, `bestTeiler` → `teiler` (Rename fuer Klarheit)
- [ ] `/migrate rename-matchresult-to-series`

#### Scoring-Engine (neues Modul)

- [ ] `src/lib/scoring/calculateScore.ts` — universelle Score-Berechnung:
  - `calculateCorrectedTeiler(teiler, faktor): number`
  - `calculateRingteiler(rings, teiler, faktor, maxRings): number`
  - `calculateScore(series, mode, discipline): number`
- [ ] `src/lib/scoring/rankParticipants.ts` — generische Rangliste:
  - `rankByScore(entries[], mode): RankedEntry[]`
  - TARGET_UNDER: zweistufiges Ranking (≤ Zielwert zuerst)
- [ ] `src/lib/scoring/types.ts` — ScoringInput, RankedEntry, etc.
- [ ] `src/lib/scoring/calculateScore.test.ts` — parametrisierte Tests fuer alle 7 Modi + Faktor-Kombinationen
- [ ] `src/lib/scoring/rankParticipants.test.ts` — Ranking-Tests inkl. TARGET-Modi

#### Bestehende Logik migrieren

- [ ] `src/lib/results/calculateResult.ts` — auf Scoring-Engine umstellen (`calculateRingteiler` + `determineOutcome` nutzen `scoring/`)
- [ ] `src/lib/standings/calculateStandings.ts` — auf Scoring-Engine umstellen
- [ ] `src/lib/results/calculateResult.test.ts` — Tests anpassen (neuer Parameter)
- [ ] `src/lib/standings/calculateStandings.test.ts` — Tests anpassen

#### Queries & Actions

- [ ] `src/lib/results/actions.ts` — MatchResult-Referenzen → Series
- [ ] `src/lib/results/queries.ts` (falls vorhanden) — anpassen
- [ ] `src/lib/matchups/queries.ts` — Nested Select: MatchResult → Series

#### Components

- [ ] Ergebnisanzeige-Komponenten: MatchResult-Referenzen → Series
- [ ] `ScheduleView.tsx` — anpassen

#### Tests & Qualitaet

- [ ] Alle bestehenden Calculate-Tests muessen gruen bleiben
- [ ] Neue Tests fuer Scoring-Engine (Prioritaet: hohe Abdeckung)
- [ ] `/check` — alle Gates gruen

#### Finalisierung

- [ ] `docs/data-model.md` — bestaetigen dass Berechnungsregeln korrekt dokumentiert sind

---

### Phase 4: Event-Modus (Kranzlschiessen)

**Ziel:** Erster neuer Wettbewerbstyp voll funktional. Erstellen, Teilnehmer einschreiben, Serien erfassen, Rangliste anzeigen.
**Abhaengigkeiten:** Phase 3 abgeschlossen (Scoring-Engine + Serie).
**Risiko:** GERING — neuer Code, kein Refactoring. Nutzt die universelle Scoring-Engine.

#### Types

- [ ] `src/lib/competitions/types.ts` — Event-spezifische Typen: `EventDetail`, `EventConfig`

#### Queries

- [ ] `src/lib/competitions/queries.ts` — Event-spezifische Abfragen (aktive Events, Event-Detail mit Serien)

#### Actions

- [ ] `src/lib/competitions/actions.ts` — `createEvent`, `updateEvent` (Zod-Schema mit Event-Pflichtfeldern)
- [ ] `src/lib/series/actions.ts` (neues Modul) — `saveEventSeries` (eine Serie pro Teilnehmer)

#### Calculate

- [ ] `src/lib/scoring/` — Event-Ranking: `rankEventParticipants(series[], competition)` mit Scoring-Engine
- [ ] Faktor-Korrektur bei gemischten Disziplinen
- [ ] TARGET-Modi Implementierung (falls noch nicht in Phase 3 abgedeckt)

#### Components

- [ ] Event-Erstellungs-Formular (CompetitionForm mit type=EVENT Feldern)
- [ ] Event-Teilnehmer-Verwaltung (inkl. Gastschuetzen, Disziplinwahl)
- [ ] Event-Serien-Erfassung (einfache Liste, eine Serie pro Teilnehmer)
- [ ] Event-Rangliste (mit Faktor-Korrektur, Disziplin-Anzeige)

#### Pages

- [ ] `/competitions/new` — Event-Erstellung (type=EVENT im Formular)
- [ ] `/competitions/[id]/series` — Serien-Erfassung fuer Events
- [ ] `/competitions/[id]/ranking` — Rangliste

#### Tests & Qualitaet

- [ ] Scoring-Engine Tests fuer alle 7 Modi mit Event-Daten
- [ ] TARGET_UNDER Ranking-Tests (zweistufig)
- [ ] `/check` — alle Gates gruen

#### Finalisierung

- [ ] `docs/` aktualisieren

---

### Phase 5: Saison-Modus (Jahrespreisschiessen)

**Ziel:** Langzeit-Wettbewerb mit Mehrfach-Wertung. Serien ueber Monate erfassen, Best-of-Logik, Mindestserien.
**Abhaengigkeiten:** Phase 4 abgeschlossen (Event-Modus, Series-Infrastruktur).
**Risiko:** GERING — neuer Code. Komplexitaet liegt in der Best-of-Auswertung (gut testbar).

#### Types

- [ ] `src/lib/competitions/types.ts` — Saison-spezifische Typen: `SeasonDetail`, `SeasonStandings`

#### Actions

- [ ] `src/lib/series/actions.ts` — `saveSeasonSeries` (mehrere Serien pro Teilnehmer, mit Datum + Disziplin)
- [ ] `src/lib/competitions/actions.ts` — `createSeason`, `updateSeason`

#### Calculate

- [ ] `src/lib/scoring/calculateSeasonStandings.ts`:
  - Beste Ringe pro Teilnehmer (hoechste Ringzahl einer einzelnen Serie)
  - Bester Teiler pro Teilnehmer (niedrigster korrigierter Teiler einer einzelnen Serie)
  - Bester Ringteiler pro Teilnehmer (niedrigster Ringteiler einer einzelnen Serie — Ringe + Teiler aus derselben Serie)
  - Mindestserien-Filter (≥ minSeries)
- [ ] `src/lib/scoring/calculateSeasonStandings.test.ts` — Tests:
  - Beste Ringe und bester Teiler aus verschiedenen Serien
  - Ringteiler aus derselben Serie
  - Faktor-Korrektur bei verschiedenen Disziplinen
  - Teilnehmer unter Mindestserien ausgegraut

#### Components

- [ ] Saison-Erstellungs-Formular (type=SEASON Felder)
- [ ] Saison-Serien-Erfassung (Liste mit Datum, Disziplinwahl, Hinzufuegen-Flow)
- [ ] Saison-Tabelle (3 Spalten: beste Ringe, bester Teiler, bester Ringteiler)
- [ ] Fortschrittsanzeige pro Teilnehmer ("12 / 20 Serien")

#### Pages

- [ ] `/competitions/[id]/series` — Serien-Verwaltung (erweitert fuer Saison: Mehrfach-Eintraege, Datum)
- [ ] `/competitions/[id]/standings` — Saison-Tabelle mit Mehrfach-Ranking

#### Tests & Qualitaet

- [ ] Saison-Standings-Tests (Prioritaet: Best-of-Logik + Faktor)
- [ ] `/check` — alle Gates gruen

#### Finalisierung

- [ ] `docs/` aktualisieren

---

### Phase 6: Liga-Ausbau (Konfigurierbare Regelsets)

**Ziel:** Volles konfigurierbares Regelset fuer Ligen innerhalb des Competition-Rahmens.
**Abhaengigkeiten:** Phase 2 abgeschlossen (Competition-Abstraktion). Kann parallel zu Phase 4/5.
**Risiko:** MITTEL — viele Breaking Points in bestehender Liga-Logik. Bereits detailliert geplant.

Hinweis: Die Felder sind in Phase 2 bereits im Schema angelegt (nullable mit Defaults).
Phase 6 implementiert die Logik und UI dafuer.

#### Actions

- [ ] `src/lib/competitions/actions.ts` — Zod-Schema um Regelset-Felder erweitern + Lock-Logik (wenn Matchups existieren → Regelset gesperrt)
- [ ] `src/lib/results/actions.ts` — `scoringMode` aus Competition laden + an `determineOutcome()` uebergeben
- [ ] `src/lib/playoffs/actions.ts` — `playoffBestOf`, `playoffQualThreshold`, `finaleScoringMode`, `finaleHasSuddenDeath` aus Competition laden + verwenden

#### Calculate

- [ ] `src/lib/results/calculateResult.ts` — `determineOutcome()` um `scoringMode` Parameter erweitern
- [ ] `src/lib/playoffs/calculatePlayoffs.ts`:
  - `isPlayoffMatchComplete(match, requiredWins)` — hardkodierte 3 durch Parameter
  - `createFirstRoundMatchups(standings, ruleset)` — Qual-Parameter
  - Finale: `finaleScoringMode` nutzen
- [ ] `src/lib/standings/calculateStandings.ts` — `scoringMode` durchreichen; Sortierung bei RINGS umkehren

#### Components

- [ ] Competition-Formular — "Regelset"-Sektion mit `<fieldset disabled={hasMatchups}>` + Sperrhinweis
- [ ] `PlayoffMatchCard.tsx` — dynamische Labels (Best-of-N, Schusszahl)
- [ ] `PlayoffDuelResultDialog.tsx` — Titel mit `shotsPerSeries`
- [ ] `ScheduleView.tsx` — `scoringMode` fuer Ergebnis-Farbmarkierung

#### Tests & Qualitaet

- [ ] `calculateResult.test.ts` — neuer Parameter + RINGS-Modus Tests
- [ ] `calculatePlayoffs.test.ts` — parametrisierte Tests (bestOf, qualThreshold)
- [ ] `calculateStandings.test.ts` — scoringMode-Parameter
- [ ] `/check` — alle Gates gruen

#### Finalisierung

- [ ] `docs/` — Regelset dokumentieren

---

## Abgeschlossen

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

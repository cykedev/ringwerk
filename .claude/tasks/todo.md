# Aufgaben-Log – Liga-App

---

## Aktuell

### [2026-03-12] Feature: Konfigurierbare Regelsets pro Liga

**Ziel:** Wettkampfregeln (bisher hardkodiert) werden pro Liga konfigurierbar.
**Ansatz:** 8 neue Inline-Felder auf `League`, Lock nach Spielplan-Generierung.

#### Layer 1: Schema

- [ ] `prisma/schema.prisma` — neuer Enum `GroupScoringMode { RINGTEILER, HIGHEST_RINGS }` + 8 neue Felder auf `League`:
  - `shotsPerSide Int @default(10)`
  - `groupScoringMode GroupScoringMode @default(RINGTEILER)`
  - `playoffBestOf Int @default(3)` (Siege zum Weiterkommen VF/HF; 3 = Best-of-Five)
  - `playoffQualThreshold Int @default(8)` (ab dieser TN-Anzahl → Viertelfinale)
  - `playoffQualTopN1 Int @default(4)` (Qualifikanten für HF bei Direkteinstieg)
  - `playoffQualTopN2 Int @default(8)` (Qualifikanten für VF)
  - `finaleScoringMode GroupScoringMode @default(HIGHEST_RINGS)`
  - `finaleHasSuddenDeath Boolean @default(true)`

#### Layer 2: Migration

- [ ] `/migrate add-league-ruleset` — Alle Defaults = bisheriges Verhalten → kein Datenverlust

#### Layer 3: Types

- [ ] `src/lib/leagues/types.ts` — `LeagueDetail` + `LeagueListItem` um alle 8 Felder erweitern

#### Layer 4: Queries

- [ ] `src/lib/leagues/queries.ts` — alle `select`-Blöcke um neue Felder erweitern
- [ ] `src/lib/standings/queries.ts` — Liga-Ruleset an `calculateStandings()` weiterreichen
- [ ] `src/lib/playoffs/queries.ts` — `finaleScoringMode` für Duell-Auswertung laden

#### Layer 5: Actions

- [ ] `src/lib/leagues/actions.ts` — Zod-Schema erweitern + Lock-Logik in `updateLeague()` (Guard: wenn Matchups existieren → Ruleset-Felder ignorieren)
- [ ] `src/lib/results/actions.ts` — `groupScoringMode` aus Liga laden + an `determineOutcome()` übergeben
- [ ] `src/lib/playoffs/actions.ts` — `playoffBestOf`, `playoffQualThreshold`, `finaleScoringMode`, `finaleHasSuddenDeath` aus Liga laden + verwenden (Breaking: mehrere Stellen)

#### Layer 6: Calculate (Breaking Points zuerst)

- [ ] `src/lib/results/calculateResult.ts` — `determineOutcome(a, b, scoringMode?)` um optionalen Parameter erweitern; bei `HIGHEST_RINGS`: höhere Ringzahl gewinnt (kein Teiler-Vergleich)
- [ ] `src/lib/playoffs/calculatePlayoffs.ts`:
  - `isPlayoffMatchComplete(match, requiredWins)` — hardkodierte `3` durch Parameter ersetzen; Finale bleibt bei `1`
  - `createFirstRoundMatchups(standings, ruleset)` — `playoffQualThreshold`, `playoffQualTopN1/2` als Parameter
  - `determinePlayoffDuelWinner()` bleibt; Finale-Branching über `finaleScoringMode`
- [ ] `src/lib/standings/calculateStandings.ts` — `scoringMode` an `determineOutcome()` durchreichen; Tiebreak-Sortierung bei `HIGHEST_RINGS` umkehren (höher = besser)

#### Layer 7: Components

- [ ] `src/components/app/leagues/LeagueForm.tsx` — neue "Regelset"-Sektion mit `<fieldset disabled={hasMatchups}>` + alle 8 Felder (Select, Number-Input, Select für Boolean); Sperrhinweis als `text-xs text-muted-foreground`
- [ ] `src/components/app/playoffs/PlayoffMatchCard.tsx` — dynamische Labels: `shotsPerSide`-Text, `playoffBestOf`-Label (Best-of-N), Siege-bis-Weiterkommen-Text
- [ ] `src/components/app/playoffs/PlayoffDuelResultDialog.tsx` — Titel-Text mit `shotsPerSide` statt hardkodiert "10 Schüsse"
- [ ] `src/components/app/matchups/ScheduleView.tsx` — `groupScoringMode` für Ergebnis-Farbmarkierung

#### Layer 8: Pages

- [ ] `src/app/(app)/leagues/new/page.tsx` + `leagues/[id]/edit/page.tsx` — `hasMatchups: boolean` prop an `LeagueForm` übergeben
- [ ] `src/app/(app)/leagues/[id]/schedule/page.tsx` + `playoffs/page.tsx` — Ruleset-Felder weitergeben wo nötig

#### Tests & Qualität

- [ ] `src/lib/results/calculateResult.test.ts` — bestehende Tests anpassen (neuer Parameter) + neue Tests für `HIGHEST_RINGS`-Modus
- [ ] `src/lib/playoffs/calculatePlayoffs.test.ts` — Tests parametrisieren (`bestOf`, `qualThreshold`) + neue Szenarien
- [ ] `src/lib/standings/calculateStandings.test.ts` — `scoringMode`-Parameter + neue Tests
- [ ] `src/lib/leagues/actions.test.ts` — Ruleset-Validierung + Lock-Logik testen
- [ ] `/check` — alle Gates grün

#### Finalisierung

- [ ] `docs/data-model.md` + `docs/features.md` — Regelset dokumentieren

---

### [2026-03-10] Feature: Liga endgültig löschen (Force Delete)

- [x] `src/lib/leagues/actions.ts` – `forceDeleteLeague()` Server Action (Auth → Name-Bestätigung → transaktionale Kaskadenlöschung)
- [x] `src/components/app/leagues/ForceDeleteLeagueSection.tsx` – Gefahrenzone-Sektion mit AlertDialog und Name-Eingabe
- [x] `src/app/(app)/leagues/[id]/edit/page.tsx` – `ForceDeleteLeagueSection` eingebunden
- [x] `src/lib/leagues/actions.test.ts` – 7 neue Tests für `forceDeleteLeague`
- [x] `docs/features.md` – Abschnitt „Liga endgültig löschen" ergänzt
- [x] `docs/architecture.md` – `actions.ts`-Beschreibung aktualisiert

**Review:** Admin kann eine Liga jetzt unabhängig von Status und Spielfortschritt komplett löschen. Gefahrenzone auf der Edit-Seite, AlertDialog mit Name-Bestätigung (case-sensitive). Kaskadenlöschung erfolgt manuell bottom-up in einer Transaktion (PlayoffDuelResults → PlayoffDuels → PlayoffMatches → MatchResults → Matchups → AuditLog → LeagueParticipants → League), da kein `onDelete: Cascade` im Schema definiert ist.

---

### [2026-03-10] Mobile-Optimierung: Playoffs-Seite

- [x] `PlayoffMatchCard.tsx` – `CardHeader` / `CardContent` Padding: `px-6` → `px-4 sm:px-6`
- [x] `PlayoffMatchCard.tsx` – Duell-Zeilen: `px-3` → `px-2 sm:px-3`
- [x] `PlayoffMatchCard.tsx` – „ausstehend"-Placeholder-Text aus pending-Duell-Zeilen entfernt (alle Breakpoints)
- [x] `PlayoffBracket.tsx` – Finale-Karte: `max-w-xs mx-auto sm:max-w-sm` für Single-Match-Runden; `sm:grid-cols-2` nur bei `matches.length > 1` aktiv
- [x] `PlayoffDuelResultDialog.tsx` – „Eintragen"-Button icon-only auf Mobile (`hidden sm:inline` für Textlabel)
- [x] `/check` grün (Lint ✅, Format ✅, 108 Tests ✅, TSC ✅)

**Review:** Playoffs-Seite auf 375 px (iPhone) deutlich kompakter. Karten nutzen `px-4` statt `px-6` auf Mobile; Finale-Karte zentriert mit sichtbaren Rändern (`max-w-xs`). Kein Placeholder-Text mehr in offenen Duell-Zeilen. „Eintragen"-Button zeigt nur `+`-Icon auf Mobile, volles Label ab `sm`. Klassisches Responsive-Button-Muster konsistent mit Navigation.

---

### [2026-03-10] Refactor: Automatisches Duell bei VF/HF-Unentschieden

- [x] `addSuddenDeathDuel` generalisiert zu `addExtraDuel(id, isSuddenDeath)` in `src/lib/playoffs/actions.ts`
- [x] Bei VF/HF-Unentschieden: nächstes Duell wird automatisch angelegt (analog Finale Sudden Death)
- [x] Hard-Limit von 5 Duellen pro Match in `PlayoffMatchCard.tsx` entfernt
- [x] `docs/features.md` – Best-of-Five-Beschreibung aktualisiert (kein hartes Limit mehr)
- [x] `docs/data-model.md` – Glossareintrag „Best-of-Five" aktualisiert

**Review:** `addExtraDuel` übernimmt jetzt beide Fälle (Finale SD und VF/HF Draw). In VF/HF wird nach jedem Unentschieden automatisch ein weiteres Duell angelegt, bis ein Sieger feststeht. Das 5-Duelle-Limit im Client wurde entfernt, da es den automatischen Flow blockiert hätte.

---

### [2026-03-09] Feature: Playoff-Phase

- [x] src/lib/playoffs/types.ts (PlayoffDuelItem, PlayoffMatchItem, PlayoffBracketData, SavePlayoffDuelResultInput)
- [x] src/lib/playoffs/calculatePlayoffs.ts (determinePlayoffDuelWinner, isPlayoffMatchComplete, createFirstRoundMatchups, createNextRoundMatchups)
- [x] src/lib/playoffs/calculatePlayoffs.test.ts (22 Tests)
- [x] src/lib/playoffs/queries.ts (getPlayoffBracket)
- [x] src/lib/playoffs/actions.ts (startPlayoffs, savePlayoffDuelResult, addPlayoffDuel)
- [x] src/components/app/playoffs/StartPlayoffsButton.tsx
- [x] src/components/app/playoffs/PlayoffDuelResultDialog.tsx
- [x] src/components/app/playoffs/PlayoffMatchCard.tsx
- [x] src/components/app/playoffs/PlayoffBracket.tsx
- [x] src/app/(app)/leagues/[id]/playoffs/page.tsx
- [x] leagues/page.tsx + schedule/page.tsx – Playoffs-Link
- [x] /check grün (Lint, Format, 105 Tests, TSC)

**Review:** Playoff-Phase vollständig. Admin kann Playoffs starten (sobald keine PENDING-Paarungen mehr und ≥4 aktive TN). Bracket-Seeding: 4–7 TN → HF (1v4, 2v3), 8+ TN → VF (1v8, 2v7, 3v6, 4v5). VF/HF Best-of-Five: Einzelduelle werden manuell angelegt und eingetragen. Nächste Runde wird manuell vom Admin über „Halbfinale/Finale anlegen"-Button angesetzt. Finale: 1 Duell, Gleichstand → automatisches Sudden-Death-Duell. Korrekturen: Duell-Ergebnisse korrigierbar solange Folgerunde keine Duele hat; letztes Duell löschbar. Cascade-Delete leerer Folge-Matches bei Korrektur. Spieler-Rückzug nach Playoff-Start blockiert. Spielplan-Editierung nach Playoff-Start blockiert.

---

### [2026-03-09] Feature: Ergebniserfassung + Tabelle

- [x] src/lib/results/types.ts (ResultInput, SaveMatchResultInput, MatchResultSummary)
- [x] src/lib/results/calculateResult.ts (calcRingteiler, determineOutcome, MAX_RINGS)
- [x] src/lib/results/calculateResult.test.ts (14 Tests)
- [x] src/lib/results/actions.ts (saveMatchResult – Auth, Upsert, AuditLog bei Korrektur)
- [x] src/lib/standings/calculateStandings.ts (Tabellenberechnung: Punkte, direkter Vergleich, best RT)
- [x] src/lib/standings/calculateStandings.test.ts (10 Tests)
- [x] src/lib/standings/queries.ts (getStandingsForLeague)
- [x] src/lib/matchups/types.ts – MatchResultSummary + results[] in MatchupListItem
- [x] src/lib/matchups/queries.ts – results-Select hinzugefügt (Decimal → number)
- [x] src/components/app/results/ResultEntryDialog.tsx (Dialog, useState, useTransition)
- [x] src/components/app/matchups/ScheduleView.tsx – Ergebnisanzeige + Eintragen/Korrigieren-Button
- [x] src/components/app/standings/StandingsTable.tsx
- [x] src/app/(app)/leagues/[id]/standings/page.tsx
- [x] src/app/(app)/leagues/[id]/schedule/page.tsx – isAdmin, Tabellen-Link
- [x] src/app/(app)/leagues/page.tsx – Tabellen-Link in aktiver + abgeschlossener Liga-Zeile
- [x] /check grün (Lint, Format, 83 Tests, TSC)

**Review:** Ergebniserfassung vollständig. Admin kann Ergebnisse (Gesamtringe + Teiler) für jede PENDING-Paarung eintragen. Ringteiler wird automatisch berechnet. COMPLETED-Paarungen können korrigiert werden (AuditLog). Tabelle wird aus allen COMPLETED-Paarungen berechnet (Punkte → direkter Vergleich → bester RT). Zurückgezogene Teilnehmer am Ende, ihre Duelle nicht gewertet. Nächster Schritt: Playoff-Phase.

---

### [2026-03-09] Feature: Spielplan-Generierung

- [x] prisma/schema.prisma – `roundIndex Int` zu `Matchup` hinzugefügt
- [x] Migration: `20260309115812_add_matchup_round_index`
- [x] src/lib/matchups/types.ts (MatchupListItem, ScheduleStatus)
- [x] src/lib/matchups/generateSchedule.ts (Circle-Method, Hin- + Rückrunde, Freilos)
- [x] src/lib/matchups/generateSchedule.test.ts (16 Tests, alle grün)
- [x] src/lib/matchups/queries.ts (getMatchupsForLeague, getScheduleStatus)
- [x] src/lib/matchups/actions.ts (generateLeagueSchedule – Auth, Validierung, Transaktion)
- [x] src/components/app/matchups/GenerateScheduleButton.tsx (AlertDialog, useTransition)
- [x] src/components/app/matchups/ScheduleView.tsx (Tabellenansicht, Deadline am Header)
- [x] src/app/(app)/leagues/[id]/schedule/page.tsx
- [x] Navigation: leagues/page.tsx + leagues/[id]/participants/page.tsx verlinkt
- [x] /check grün (Lint, Format, 59 Tests, TSC)

**Review:** Spielplan-Feature vollständig. Admin kann für jede aktive Liga mit ≥4 Teilnehmern einen Doppelrunden-Spielplan (Round Robin, Circle Method) generieren. Ungerade Teilnehmerzahl → Freilos. Rückrunde spiegelt Heimrecht. Regenerierung möglich solange keine abgeschlossenen Paarungen. Anzeige als zwei flache Tabellen (Hin-/Rückrunde) mit Spieltag-Spalte und Deadline am Abschnittsheader. Nächster Schritt: Ergebniserfassung.

---

### [2026-03-09] Feature: Teilnehmer

- [x] src/lib/participants/types.ts (ParticipantListItem, ParticipantDetail, ParticipantOption)
- [x] src/lib/participants/queries.ts (getParticipants, getParticipantsForManagement, getParticipantById, getParticipantsNotInLeague)
- [x] src/lib/participants/actions.ts (createParticipant, updateParticipant, setParticipantActive)
- [x] src/lib/leagueParticipants/types.ts (LeagueParticipantListItem)
- [x] src/lib/leagueParticipants/queries.ts (getLeagueParticipants)
- [x] src/lib/leagueParticipants/actions.ts (enrollParticipant, unenrollParticipant, withdrawParticipant, revokeWithdrawal, updateStartNumber)
- [x] src/components/app/participants/ParticipantForm.tsx
- [x] src/components/app/participants/ParticipantRowActions.tsx
- [x] src/components/app/leagueParticipants/EnrollParticipantForm.tsx
- [x] src/components/app/leagueParticipants/LeagueParticipantActions.tsx
- [x] src/app/(app)/participants/page.tsx
- [x] src/app/(app)/participants/new/page.tsx
- [x] src/app/(app)/participants/[id]/edit/page.tsx
- [x] src/app/(app)/leagues/[id]/participants/page.tsx
- [x] src/app/(app)/leagues/page.tsx – Teilnehmer-Link auf Liga-Zeile
- [x] /check grün (Lint, Format, Test, TSC)

**Review:** Teilnehmer-Feature vollständig. Admin kann Teilnehmer anlegen, bearbeiten und deaktivieren. Einschreibung in Ligen mit optionaler Startnummer. Rückzug mit Begründung + AuditLog-Eintrag. Rückzug rückgängig (gesperrt wenn Playoffs gestartet) + AuditLog. Aus Liga entfernen nur ohne Matchups. Ligen-Seite verlinkt direkt auf Teilnehmerverwaltung je Liga. Nächster Schritt: Spielplan-Generierung.

---

## Abgeschlossen

### [2026-03-09] Projektinitialisierung

- [x] Anforderungsdokument (SRS v1.5) analysiert
- [x] CLAUDE.md erstellt (slim, orchestrierungsfokussiert)
- [x] docs/features.md – funktionale Anforderungen
- [x] docs/technical.md – technischer Stack & Architektur
- [x] docs/data-model.md – Entitäten, Berechnungsregeln, Glossar
- [x] docs/open-issues.md – offene Punkte aus SRS
- [x] tasks/todo.md & tasks/lessons.md angelegt
- [x] docs/code-conventions.md – Namenskonventionen, Enums (englisch), TS-Regeln, Testing

**Review:** Projektstruktur aufgesetzt. Nächster Schritt: Tech Stack initialisieren (Next.js, Prisma, shadcn/ui) und Datenbankschema entwerfen.

### [2026-03-09] Tech Stack Setup

- [x] package.json, tsconfig.json, next.config.ts, prisma.config.ts
- [x] eslint.config.mjs, .prettierrc, vitest.config.ts, postcss.config.mjs
- [x] .gitignore, .env.example, components.json
- [x] prisma/schema.prisma (vollständiges Datenmodell aus schema-draft.prisma)
- [x] Dockerfile (multi-stage: deps → builder → migrator → runner)
- [x] docker-compose.dev.yml (3 Services: db, migrate, app; Watch-Modus)
- [x] scripts/ (run-migrations-with-recovery.sh, start-dev-with-migrations.sh, resolve-failed-migrations.mjs)
- [x] src/lib/db.ts, auth.ts, auth-helpers.ts, startup.ts, authValidation.ts, utils.ts, types.ts
- [x] src/lib/auth-rate-limit/ (config, types, normalization, store, limiter, index)
- [x] src/proxy.ts (Next.js 16 Middleware)
- [x] src/types/next-auth.d.ts
- [x] src/app/layout.tsx, globals.css, (public)/login/page.tsx
- [x] src/app/(app)/layout.tsx, page.tsx (Dashboard), admin/layout.tsx
- [x] src/app/api/auth/[...nextauth]/route.ts
- [x] src/components/app/shell/ (Providers, Navigation)
- [x] src/components/ui/ (shadcn: button, card, input, label, ...)
- [x] npm install + prisma generate
- [x] Erste Migration: 20260309083153_init

**Review:** Basis-Setup vollständig. Login, Auth-Guard, Admin-Seeding, Docker-Dev-Stack verifiziert. Nächster Schritt: erstes Feature implementieren (Disziplinen oder Teilnehmer).

### [2026-03-09] Feature: Disziplinen

- [x] src/lib/disciplines/types.ts (DisciplineUsage)
- [x] src/lib/disciplines/queries.ts (getDisciplines, getDisciplinesForManagement, getDisciplineById)
- [x] src/lib/disciplines/actions.ts (create, update, setArchived, delete)
- [x] src/lib/disciplines/systemDisciplines.ts (ensureSystemDisciplines – LP, LG, LPA, LGA)
- [x] src/lib/startup.ts – ensureSystemDisciplines eingebunden
- [x] src/components/app/disciplines/DisciplineForm.tsx
- [x] src/components/app/disciplines/DisciplineActions.tsx (Dropdown: bearbeiten, archivieren, löschen)
- [x] src/components/ui/dropdown-menu.tsx (neues shadcn-Komponente)
- [x] src/app/(app)/disciplines/page.tsx
- [x] src/app/(app)/disciplines/new/page.tsx
- [x] src/app/(app)/disciplines/[id]/edit/page.tsx
- [x] /check grün (Lint, Format, Test, TSC)

**Review:** Disziplinen-Feature vollständig. Systemdisziplinen werden beim ersten App-Start automatisch angelegt. Admin kann eigene Disziplinen anlegen, bearbeiten, archivieren und löschen. Nächster Schritt: Teilnehmer-Feature.

### [2026-03-09] Feature: Nutzerverwaltung + Account

- [x] src/lib/users/types.ts
- [x] src/lib/users/queries.ts (getUsers, getUserById)
- [x] src/lib/users/actions.ts (createUser, updateUser, setUserActive, changeOwnPassword)
- [x] src/components/app/users/UserCreateForm.tsx
- [x] src/components/app/users/UserEditForm.tsx
- [x] src/components/app/users/UserRowActions.tsx (Aktivieren/Deaktivieren, Bearbeiten)
- [x] src/app/(app)/admin/users/page.tsx
- [x] src/app/(app)/admin/users/new/page.tsx
- [x] src/app/(app)/admin/users/[id]/edit/page.tsx
- [x] src/app/(app)/account/page.tsx (Passwort ändern)
- [x] src/components/app/account/AccountPasswordForm.tsx
- [x] src/components/app/shell/Navigation.tsx (Admin-Nav + Mobile-Nav erweitert)
- [x] src/lib/disciplines/actions.test.ts (Unit-Tests für Disziplinen-Actions)

**Review:** Nutzerverwaltung vollständig. Admin kann Nutzer anlegen, bearbeiten, (de)aktivieren und Passwort zurücksetzen. Letzter aktiver Admin und eigener Account sind gegen Deaktivierung geschützt. Passwortänderung invalidiert alle aktiven Sessions via sessionVersion. Jeder Nutzer kann sein eigenes Passwort unter /account ändern. Nächster Schritt: Liga-Feature.

### [2026-03-09] Feature: Ligen

- [x] src/lib/leagues/types.ts (LeagueListItem, LeagueDetail)
- [x] src/lib/leagues/queries.ts (getLeagues, getLeaguesForManagement, getLeagueById)
- [x] src/lib/leagues/actions.ts (createLeague, updateLeague, setLeagueStatus, deleteLeague)
- [x] src/lib/leagues/actions.test.ts (43 Tests, alle grün)
- [x] src/components/app/leagues/LeagueForm.tsx
- [x] src/components/app/leagues/LeagueActions.tsx (Dropdown: bearbeiten, abschliessen, wieder öffnen, archivieren, wiederherstellen, löschen)
- [x] src/app/(app)/leagues/page.tsx
- [x] src/app/(app)/leagues/new/page.tsx
- [x] src/app/(app)/leagues/[id]/edit/page.tsx
- [x] /check grün (Lint, Format, Test, TSC)

**Review:** Liga-Feature vollständig. Admin kann Ligen anlegen, bearbeiten und löschen (nur ohne abhängige Daten). Statusübergänge bidirektional: ACTIVE ↔ COMPLETED ↔ ARCHIVED (direkt ACTIVE → ARCHIVED bleibt blockiert). Disziplin nach Erstellung unveränderlich. Stichtage optional. Nächster Schritt: Teilnehmer-Feature (inkl. Liga-Einschreibung).

### [2026-03-09] Datum & Zeitzone

- [x] src/lib/dateTime.ts (server-only; getDisplayTimeZone, formatDateOnly via Intl.DateTimeFormat)
- [x] leagues/page.tsx – toLocaleDateString ersetzt durch formatDateOnly(date, tz)
- [x] .env.example – DISPLAY_TIME_ZONE=Europe/Berlin dokumentiert
- [x] docker-compose.dev.yml – DISPLAY_TIME_ZONE=Europe/Berlin im App-Service eingetragen
- [x] docs/technical.md – Abschnitt «Datum & Zeitzone» ergänzt
- [x] docs/code-conventions.md – Regel und Beispiele für formatDateOnly dokumentiert
- [x] README.md – DISPLAY_TIME_ZONE in Konfigurationstabelle + Projektstruktur
- [x] /check grün (Lint, Format, Test, TSC)

**Review:** UTC/Timezone-Pattern von treffsicher übernommen. Alle Datumsanzeigen nutzen jetzt `formatDateOnly(date, tz)` mit expliziter IANA-Zeitzone. `toLocaleDateString` ohne Zeitzone ist verboten (würde in Docker UTC anzeigen). Nächster Schritt: Teilnehmer-Feature.

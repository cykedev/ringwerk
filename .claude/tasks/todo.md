# Aufgaben-Log – Ringwerk

---

## Aktuell

_Keine offenen Tasks._

---

## Abgeschlossen

### [2026-03-26] Bugfix: TARGET_OVER Penalty-Tier Vorzeichen

- `EventRankingTable`, `EventTeamRankingTable`, `EventRankingPdf`: Penalty-Tier zeigt `-X` statt `+X` (Wert liegt unter dem Ziel)

---

### [2026-03-26] Bugfix: TARGET_OVER Label-Maps in Pages/Components/PDF

- `ranking/page.tsx`, `standings/page.tsx`: Badge-Label "Zielwert über" ergänzt
- `EventRankingTable`, `EventTeamRankingTable`: Spaltenheader + `formatScore` 1e9-Check
- `EventRankingPdf`: beide Label-Maps + `formatScore`; `SeasonStandingsPdf`: Label-Map

---

### [2026-03-26] Bugfix: TARGET_OVER fehlt im Zod-Schema (actions.ts)

- `BaseSchema.scoringMode` in `src/lib/competitions/actions.ts` um `"TARGET_OVER"` ergänzt

---

### [2026-03-26] TARGET_OVER Wertungsmodus

- `ScoringMode` Enum + Migration `20260326100000_add_target_over_scoring_mode`
- `calculateScore.ts`: `TARGET_OVER` Case (≥ Zielwert → bevorzugte Tier, sonst 1e9 + Abweichung)
- `types.ts`: `SCORE_DIRECTION` + `rankEventParticipants.ts`: `ascModes` erweitert
- `CompetitionForm.tsx`: Label "Zielwert (über)" + `isTargetMode` erweitert
- 4 Tests; 241 Tests grün, alle Gates grün

---

### [2026-03-26] Bugfix: WITHDRAWN-Teilnehmer in Ranglisten

- `getEventWithSeries`: `status` zu CP- und participant.competitions-Select hinzugefügt; Filter auf `status === "ACTIVE"` vor dem Mapping
- `getSeasonWithSeries`: `where: { status: "ACTIVE" }` in Participant-Query — WITHDRAWN-Teilnehmer erscheinen nicht mehr in Standings

---

### [2026-03-26] Team-Support für Event-Wettbewerbe

- Schema: `TeamScoring` Enum, `EventTeam` Modell, `CompetitionParticipant.eventTeamId`, `Series.competitionParticipantId`, partielle Unique-Indizes
- `rankEventTeams()` + `computeTeamScore()` Helper; Identity-Key-Fix in `rankByScore`
- `EventTeamRankingTable`, Team-Support in EnrollParticipantForm, EventSeriesDialog, EventRankingTable, all pages + PDF
- 237 Tests grün, alle Quality Gates grün

---

### [2026-03-26] Rang-Badge-Konsistenz

- Neue gemeinsame Komponente `src/components/ui/rank-badge.tsx` (Pill, gold/silber/bronze/muted)
- `SeasonStandingsTable`, `StandingsTable`, `EventRankingTable` — alle nutzen `RankBadge`
- PDFs vereinheitlicht: `borderRadius: 9` → `borderRadius: 3`, Rang-4+-Farbe `#374151` → `#9ca3af`

---

### [2026-03-25] PDF: Event-Rangliste & Saison-Standings + Badge-Verfeinerungen

- EventRankingPdf + API-Route + PdfDownloadButton in ranking/page.tsx
- SeasonStandingsPdf + API-Route + PdfDownloadButton in standings/page.tsx
- Rang-Badges (gold/silber/bronze) in allen Metrik-Zellen; Per-Metrik-Ränge in calculateSeasonStandings

---

### [2026-03-18] Playoff-Achtelfinale (EIGHTH_FINAL)

- Schema: `playoffHasViertelfinale` / `playoffHasAchtelfinale` Boolean-Flags, `EIGHTH_FINAL` Enum; Migration `playoff-boolean-rounds`
- `calculatePlayoffs.ts` — 3-Pfad-Routing (AF/VF/HF); `PlayoffBracket.tsx` 4-Spalten-Layout; 203 Tests grün

---

### [2026-03-17] Phase 5: Saison-Modus

- `saveSeasonSeries`, `deleteSeasonSeries`, `calculateSeasonStandings.ts` (3 Metriken: beste Ringe/Teiler/Ringteiler + Mindestserien-Filter)
- `SeasonSeriesDialog`, `SeasonStandingsTable` (3-Spalten); 13 neue Tests; 179 Tests grün

---

### [2026-03-17] Phase 4: Event-Modus

- Event-Modus komplett: Types, Queries, Actions (`saveEventSeries`, `deleteEventSeries`), 5 neue Komponenten
- Routen `/competitions/[id]/series` + `/ranking`; Faktor-Korrektur bei gemischten Disziplinen; Gast-Support

---

### [2026-03-17] Phase 3: Scoring-Engine + Serie

- `MatchResult` → `Series`, `totalRings` → `rings`; neue Felder: `disciplineId`, `shotCount`, `sessionDate`, `matchupId nullable`, `teilerFaktor Decimal(9,7)`
- Neue Scoring-Engine: `calculateScore.ts` (7 Modi) + `rankParticipants.ts` + 38 Tests
- Bestehende Logik (calculateResult, calculateStandings) auf Engine migriert; 157 Tests grün

---

### [2026-03-16] Phase 2: Competition-Abstraktion

- `League` → `Competition`, `LeagueParticipant` → `CompetitionParticipant` (Schema, manuelle Migration, alle Module)
- Typ-spezifische nullable Felder für Liga/Event/Saison; Navigation auf "Wettbewerbe", Routen `/competitions/`
- Alle Imports, Components, Pages, PDF-Routen aktualisiert; Docs-Sync abgeschlossen

---

### [2026-03-16] Phase 1: Fundament

- `Discipline.teilerFaktor Decimal @default(1.0)` + Migration; Default-Faktoren in `systemDisciplines.ts` (LP=0.3333333, LPA=0.6, LGA=1.8)
- `CompetitionType`, `ScoringMode`, `TargetValueType` Enums vorbereitet; Faktor-Feld in DisciplineForm + DisciplineList
- App auf "Ringwerk" umbenannt (package.json, Navigation, Meta-Tags, README)

---

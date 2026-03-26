# Aufgaben-Archiv – Ringwerk

Archivierte abgeschlossene Tasks (zu alt für das aktive Log).

---

### [2026-03-18] Refactor: Finale-Scoring-Konfiguration

- Schema: `finaleScoringMode` entfernt, `finalePrimary / finaleTiebreaker1 / finaleTiebreaker2` hinzugefügt; Migration inkl. Datenmigration
- `calculatePlayoffs.ts` — `determineFinaleRoundWinner()` mit Kriterien-Kette, `finaleNeedsTeiler()`
- `CompetitionForm.tsx` — 3 separate Felder; alle Playoff-Komponenten + Tests aktualisiert

---

### [2026-03-18] Phase 6: Liga-Ausbau (Konfigurierbare Regelsets)

- 6 Liga-Felder aktiviert (Phase 2 vorbereitet): `scoringMode`, `shotsPerSeries`, `bestOf`, Qual-Threshold, Playoff-Flags
- Zod-Validierung + Lock-Logik bei bestehenden Matchups; `determineOutcome()` mit dynamischer Wertung
- `bestRings` in StandingsRow; dynamische Labels in PlayoffMatchCard/Dialog; `finaleNeedsTeiler` parametrisiert

---

### [2026-03-16] Ringwerk-Planung

- 3 Wettbewerbstypen (Liga, Event, Saison) + 7 Wertungsmodi + Teiler-Faktor-Konzept definiert
- Name "Ringwerk" gewählt; Iterationsplan (6 Phasen) erstellt; Docs aktualisiert

---

### [2026-03-12] Feature: Konfigurierbare Regelsets pro Liga (geplant)

- Geplant, nicht implementiert — aufgegangen in Phase 6 des Ringwerk-Umbaus

---

### [2026-03-10] Feature: Liga endgültig löschen (Force Delete)

- `forceDeleteLeague()` Server Action (Auth → Name-Bestätigung → transaktionale Kaskadenlöschung)
- `ForceDeleteLeagueSection.tsx` Gefahrenzone-Sektion; 7 neue Tests

---

### [2026-03-10] Mobile-Optimierung: Playoffs-Seite

- `PlayoffMatchCard.tsx` — Padding reduziert; `PlayoffBracket.tsx` — Finale max-w-xs auf Mobile
- `PlayoffDuelResultDialog.tsx` — „Eintragen"-Button icon-only auf Mobile

---

### [2026-03-10] Refactor: Automatisches Duell bei VF/HF-Unentschieden

- `addSuddenDeathDuel` → `addExtraDuel(id, isSuddenDeath)`; bei VF/HF-Unentschieden: nächstes Duell automatisch angelegt
- Hard-Limit von 5 Duellen pro Match entfernt

---

### [2026-03-09] Feature: Playoff-Phase

- Vollständige Playoff-Implementierung (Types, Calculate, Queries, Actions, Components, Pages); 22 Tests

---

### [2026-03-09] Feature: Ergebniserfassung + Tabelle

- ResultEntryDialog, ScheduleView, StandingsTable vollständig implementiert; 83 Tests

---

### [2026-03-09] Feature: Spielplan-Generierung

- Round-Robin mit Circle-Method, Hin-/Rückrunde, Freilos; 59 Tests

---

### [2026-03-09] Feature: Teilnehmer

- CRUD, Einschreibung, Rückzug, Startnummer implementiert

---

### [2026-03-09] Projektinitialisierung + Tech Stack + Basis-Features

- Next.js 16, Prisma 7, Auth, Docker, shadcn/ui; Disziplinen, Nutzerverwaltung, Ligen, Datumsverwaltung

---

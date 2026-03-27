# Code-Review Plan — Ringwerk

Generiert: 2026-03-27
Basis: Kritischer Vollreview (Security, Konsistenz, Simplicity, Best Practices, Tests)

---

## Legende

| Prio | Bedeutung |
|------|-----------|
| 🔴 KRITISCH | Vor Launch zwingend |
| 🟠 HOCH | Sollte bald adressiert werden |
| 🟡 MITTEL | Wichtig, aber kein Blocker |
| 🟢 NIEDRIG | Nice-to-have, Tech-Debt |

---

## 🔴 KRITISCH — Vor Launch

### R-01 · Error Boundaries fehlen komplett

**Problem:** Kein einziges `error.tsx` im gesamten `src/app/`-Baum. Bei einem unbehandelten Server-Component-Fehler sieht der User einen weißen Bildschirm oder einen rohen Next.js-Stacktrace.

**Scope:**
- `src/app/error.tsx` — globale Fallback-Seite
- `src/app/(app)/error.tsx` — für den eingeloggten Bereich
- `src/app/(public)/error.tsx` — für Login-Bereich

**Umsetzung:** `"use client"` + `error: Error & { digest?: string }` + `reset: () => void`-Props, Fehlertext auf Deutsch, Button "Seite neu laden".

---

### R-02 · `console.error(error)` — interne Details nach außen

**Problem:** An 5 Stellen wird das rohe Exception-Objekt in `console.error` geloggt. Im Production-Log landen damit potenziell interne Pfade, DB-Fehlermeldungen oder Stacktraces.

**Dateien & Zeilen:**
- `src/lib/competitions/actions.ts:454`
- `src/lib/playoffs/actions.ts:96, 348, 768`
- `src/lib/results/actions.ts:160`

**Fix:** Error-Nachricht separat extrahieren, niemals das Objekt selbst loggen:
```ts
// Vorher
console.error("Fehler beim Starten der Playoffs:", error)

// Nachher
const msg = error instanceof Error ? error.message : String(error)
console.error("Fehler beim Starten der Playoffs:", msg)
```

---

## 🟠 HOCH — Bald adressieren

### R-03 · Audit Log: User- und Participant-Ops nicht geloggt

**Problem:** `createUser`, `updateUser`, `createParticipant`, `updateParticipant` und alle `disciplines/actions.ts`-Ops schreiben keinen AuditLog-Eintrag. Damit fehlt der Nachweis wer wann Stammdaten verändert hat.

**Fehlende Einträge:**
- `USER_CREATED`, `USER_UPDATED`, `USER_DEACTIVATED`
- `PARTICIPANT_CREATED`, `PARTICIPANT_UPDATED`, `PARTICIPANT_DEACTIVATED`
- `DISCIPLINE_CREATED`, `DISCIPLINE_UPDATED`, `DISCIPLINE_ARCHIVED`
- `COMPETITION_CREATED`, `COMPETITION_UPDATED` (Wettbewerb-Anlage/-Änderung)

**Umsetzung:** Jede Action die Stammdaten verändert bekommt ein `db.auditLog.create()` am Ende — analog zu `series/actions.ts` als Referenz.

---

### R-04 · Fehlende Tests: Series-, User- und Results-Actions

**Problem:** Die Scoring-Engine ist gut getestet, aber die entscheidenden Mutations — `saveSeriesResult`, `createUser`, `updateUser`, `enrollParticipant` (Edge Cases), `unenrollParticipant` — haben wenig bis keine Tests.

**Priorisierte Lücken:**
1. `src/lib/series/actions.ts` — gar keine Tests
2. `src/lib/users/actions.ts` — gar keine Tests
3. `src/lib/results/actions.ts` — gar keine Tests
4. `src/lib/competitionParticipants/actions.test.ts` — Basis existiert, Edge Cases fehlen (Doppel-Enrollment, WITHDRAWN-Status)

**Hinweis:** Tests für Actions nutzen Mocks. Mocks sollten realistische Daten zurückgeben, nicht nur `{}`.

---

### R-05 · `playoffs/actions.ts` (771 LOC) aufteilen

**Problem:** Die Datei ist zu groß für einfaches Reasoning und Code-Review. Playwright-Fehler, Merge-Konflikte und parallele Änderungen werden schwieriger.

**Vorschlag:**
```
src/lib/playoffs/
  actions/
    start.ts        — startPlayoffs()
    duel.ts         — savePlayoffDuelResult(), deletePlayoffDuelResult()
    match.ts        — completePlayoffMatch(), reopenPlayoffMatch()
    manualDuel.ts   — createManualPlayoffDuel()
  index.ts          — re-exportiert alles
```

**Vorgehen:** Refactoring in einem Commit, danach `/check`.

---

### R-06 · `competitions/actions.ts` (460 LOC) aufteilen

**Problem:** Analog zu R-05 — Create, Update, Status, Delete und Force-Delete in einer Datei.

**Vorschlag:**
```
src/lib/competitions/
  actions/
    create.ts       — createCompetition()
    update.ts       — updateCompetition(), setCompetitionStatus()
    delete.ts       — archiveCompetition(), forceDeleteCompetition()
  index.ts          — re-exportiert alles
```

---

### R-07 · Zod-Enum nicht mit Prisma-Enum synchronisiert

**Bekannt aus Lessons (2026-03-26):** Das Zod-Enum für `scoringMode` in `competitions/actions.ts` (~Zeile 28) ist eine manuelle Liste, die bei jedem neuen `ScoringMode`-Wert manuell aktualisiert werden muss.

**Fix:** Aus dem Prisma-generierten Enum ableiten statt manuell pflegen:
```ts
import { ScoringMode } from "@/generated/prisma"
// ...
scoringMode: z.nativeEnum(ScoringMode)
```

Das eliminiert die Fehlerklasse "neuer Prisma-Enum-Wert, aber Zod kennt ihn nicht".

---

## 🟡 MITTEL — Wichtig, kein Launch-Blocker

### R-08 · Loading States fehlen

**Problem:** Keine einzige `loading.tsx` im App-Verzeichnis. Bei langsamen DB-Queries (z.B. Standings-Berechnung, Playoffs-Ansicht) sieht der User einen leeren Bildschirm.

**Scope:** Mindestens für die schweren Routen:
- `src/app/(app)/competitions/[id]/standings/loading.tsx`
- `src/app/(app)/competitions/[id]/playoffs/loading.tsx`
- `src/app/(app)/competitions/[id]/ranking/loading.tsx`

**Umsetzung:** `<Skeleton>`-Komponente aus shadcn/ui.

---

### R-09 · ScoringMode-Label-Maps verstreut

**Bekannt aus Lessons (2026-03-26):** Jede Datei (page, component, PDF) pflegt ihre eigene `Record<ScoringMode, string>`-Map.

**Fix:** Zentrale `SCORING_MODE_LABELS`-Map in `src/lib/scoring/labels.ts` (oder in `types.ts`), alle anderen importieren von dort.

**Scope:** Suche mit `grep TARGET_UNDER` findet alle betroffenen Dateien.

---

### R-10 · `"use client"` — Überprüfung auf Server-Component-Potenzial

**Problem:** 44 Dateien haben `"use client"`. Einige davon sind vermutlich unnötig (reine Datenanzeige ohne State/Events).

**Vorgehen:** Jede Datei im `src/components/app/`-Verzeichnis prüfen ob sie:
- Keine Hooks nutzt
- Keine Event-Handler hat
- Nur Props rendert

Diese können Server Components sein → kleineres JS-Bundle.

**Niedrige Priorität** — eher Qualitätsmerkmal als Bug.

---

### R-11 · Deprecated Type `MatchResultSummary`

**Datei:** `src/lib/results/types.ts`

```ts
/** @deprecated Bitte SeriesSummary verwenden */
export type MatchResultSummary = SeriesSummary
```

**Fix:** Überprüfen ob noch irgendwo genutzt (`grep MatchResultSummary src/`). Falls nicht: löschen.

---

### R-12 · `isGuestRecord`-Filter: systematische Prüfung

**Bekannt aus Lessons (2026-03-24):** Guest-Records müssen in List-Queries mit `where: { isGuestRecord: false }` gefiltert werden.

**Prüfung:** `grep -r "participant" src/lib --include="*.ts" | grep "findMany"` — jede `findMany`-Query auf Participants prüfen ob der Filter gesetzt ist.

---

## 🟢 NIEDRIG — Tech-Debt / Nice-to-have

### R-13 · `dangerouslySetInnerHTML` in `chart.tsx`

**Datei:** `src/components/ui/chart.tsx`

Technisch sicher (statische CSS-Variable-Strings), aber Best Practice wäre ein `<style>`-Element via React ohne `dangerouslySetInnerHTML`. Low Priority da shadcn/ui generierter Code.

---

### R-14 · CSRF-Dokumentation

**Problem:** Next.js Server Actions mit NextAuth bieten impliziten CSRF-Schutz (Origin-Header), aber das ist nirgends dokumentiert.

**Fix:** Kommentar in `src/lib/auth.ts` oder `auth.config.ts` der erklärt, dass NextAuth's CSRF-Token-Mechanismus (`csrfToken`) für Form-Actions aktiv ist, und warum kein manueller CSRF-Token nötig ist.

---

### R-15 · Optimistic Updates

**Problem:** Alle Server Actions blockieren die UI bis zum Abschluss. Bei Ergebniseingabe (Serienerfassung) ist das spürbar.

**Fix:** React 19 `useActionState` + `useOptimistic` für die häufigsten Mutations (Ergebniseingabe, Enrollment).

**Niedrige Prio** — erst nach Launch wenn Performance-Beschwerden kommen.

---

## Zusammenfassung nach Kategorie

| # | Titel | Prio | Kategorie |
|---|-------|------|-----------|
| R-01 | Error Boundaries | 🔴 | UX / Robustheit |
| R-02 | console.error(error) | 🔴 | Security |
| R-03 | Audit Log Lücken | 🟠 | Audit / Compliance |
| R-04 | Fehlende Tests (Actions) | 🟠 | Testabdeckung |
| R-05 | playoffs/actions.ts aufteilen | 🟠 | Maintainability |
| R-06 | competitions/actions.ts aufteilen | 🟠 | Maintainability |
| R-07 | Zod ↔ Prisma Enum sync | 🟠 | Konsistenz / Bugs |
| R-08 | Loading States | 🟡 | UX |
| R-09 | ScoringMode Labels zentralisieren | 🟡 | Konsistenz |
| R-10 | `use client` Audit | 🟡 | Performance |
| R-11 | Deprecated Type entfernen | 🟡 | Code Quality |
| R-12 | isGuestRecord Filter Audit | 🟡 | Korrektheit |
| R-13 | dangerouslySetInnerHTML | 🟢 | Security (Low) |
| R-14 | CSRF Dokumentation | 🟢 | Security / Docs |
| R-15 | Optimistic Updates | 🟢 | Performance / UX |

---

## Positives (nicht anfassen)

- ✅ Auth & Rate-Limiting: hervorragend implementiert (IP/Email, sessionVersion, bcrypt 12)
- ✅ Authorization Checks: konsequent in allen Actions
- ✅ Kein SQL-Injection-Risiko (Prisma parametrisiert, kein `$queryRaw`)
- ✅ Kein `any` im Source-Code (nur generierte Prisma-Files)
- ✅ ActionResult-Pattern: konsistent und typsicher
- ✅ Soft-Deletes: Daten bleiben für Audit-Trail erhalten
- ✅ Scoring-Engine: gut testabgedeckt mit parametrisierten Tests
- ✅ `.env` korrekt in `.gitignore`

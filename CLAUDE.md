# 1-gegen-1 Liga-App

Vereinsinterne Liga-Verwaltungs-App für 1-gegen-1 Schützenwettkämpfe.

## Session-Start

1. `tasks/todo.md` — offene Aufgaben?
2. `tasks/lessons.md` — letzte 5 Einträge lesen
3. `docs/open-issues.md` — neue Fragen?

---

## Pipeline

Jeder Request durchläuft **4 Stages**. Kein Stage überspringen.

### Stage 1: CLASSIFY

Jeden Request **zuerst** klassifizieren — vor jeder anderen Aktion:

| Klasse         | Beschreibung                          | Nächster Schritt                                                     |
| -------------- | ------------------------------------- | -------------------------------------------------------------------- |
| `NEW_PLANNED`  | Feature aus `features.md` / `todo.md` | ANALYZE: `codebase-scout` + `ui-compliance` + ggf. `schema-analyzer` |
| `NEW_UNKNOWN`  | Neue Anforderung, nicht in Specs      | Rückfrage → Scope klären → dann wie `NEW_PLANNED`                    |
| `MODIFICATION` | Änderung an bestehendem Feature       | ANALYZE: `impact-analyzer` + `codebase-scout` + `ui-compliance`      |
| `BUGFIX`       | Fehler im bestehenden Code            | ANALYZE: `codebase-scout` + ggf. `impact-analyzer`                   |
| `MAINTENANCE`  | Docs, Refactoring, Tooling, Config    | Direkt PLAN (vereinfacht, ohne Agenten)                              |

Bei Unklarheit: **Immer nachfragen, nie annehmen.**

### Stage 2: ANALYZE (Agenten parallel)

Passende Agenten **gleichzeitig** starten und auf Reports warten:

| Agent             | Wann (Pflicht)                      | Modell |
| ----------------- | ----------------------------------- | ------ |
| `impact-analyzer` | `MODIFICATION`, kritischer `BUGFIX` | opus   |
| `ui-compliance`   | Jede UI-Änderung                    | opus   |
| `codebase-scout`  | Immer (ausser `MAINTENANCE`)        | opus   |
| `schema-analyzer` | Bei DB-/Schema-Änderungen           | opus   |

### Stage 3: PLAN

1. Agenten-Reports konsolidieren
2. Hinterfragen: „Ist das der beste Weg? Gibt es eine elegantere Lösung?"
3. Bei Unklarheiten: Rückfragen stellen
4. Plan in `tasks/todo.md` mit Checkboxen schreiben
5. **Manuelle Freigabe abwarten — kein Code ohne OK**

### Stage 4: EXECUTE

**Eine zusammenhängende Phase — alle Schritte abarbeiten, erst dann ist die Aufgabe fertig.**

**Implementieren:**

- `feature-builder`-Agent (model: sonnet) für Code
- `test-writer`-Agent (model: sonnet) für Tests
- Layer-Reihenfolge einhalten (siehe unten)

**Qualität sichern:**

- Prettier ausführen
- `/check` — alle 4 Gates grün (Lint, Format, Test, TSC)
- `action-audit`-Agent auf geänderte Actions
- Bei UI-Änderung: Preview prüfen (Mobile + Desktop)

**Abschliessen (Pflicht — nicht optional):**

- `docs-sync`-Agent (model: haiku) — README, features.md, Docs
- `lessons-check`-Agent (model: haiku) — neue Lessons?
- `/commit-msg` für Commit-Message

**Die Aufgabe ist NICHT fertig, solange "Abschliessen" nicht durchgelaufen ist.**

---

## Agents — immer mit dem angegebenen Modell aufrufen!

| Agent             | Stage   | model:     | Zweck                                                     |
| ----------------- | ------- | ---------- | --------------------------------------------------------- |
| `impact-analyzer` | ANALYZE | **opus**   | Ripple-Analyse, Migrations-Risiko, betroffene Dateien     |
| `ui-compliance`   | ANALYZE | **opus**   | shadcn/ui-Pflicht, Touch-Targets, Dark-Mode, Responsive   |
| `codebase-scout`  | ANALYZE | **opus**   | Referenzen finden, Patterns empfehlen, Eleganz prüfen     |
| `schema-analyzer` | ANALYZE | **opus**   | Schema-Konventionen, Migrationssicherheit, Business-Logic |
| `feature-builder` | EXECUTE | **sonnet** | Code nach Plan implementieren                             |
| `test-writer`     | EXECUTE | **sonnet** | Domain-aware Tests generieren                             |
| `action-audit`    | EXECUTE | **haiku**  | Auth-Pattern-Audit auf Actions                            |
| `docs-sync`       | EXECUTE | **haiku**  | Docs mit Code synchronisieren                             |
| `lessons-check`   | EXECUTE | **haiku**  | Lernlog aktualisieren                                     |

## Commands

| Command           | Wann                                                |
| ----------------- | --------------------------------------------------- |
| `/check`          | Vor jedem Commit — Lint, Format, Test, TSC          |
| `/test`           | Schneller Feedback-Loop                             |
| `/migrate <name>` | Nach Schema-Änderung (erst nach `schema-analyzer`!) |
| `/commit-msg`     | Commit-Message aus Diff                             |
| `/seed`           | Nach `/db-reset`                                    |
| `/db-reset`       | Dev-DB zurücksetzen                                 |

## Hooks (automatisch, zero-context)

| Hook               | Event                  | Enforcement                                                           |
| ------------------ | ---------------------- | --------------------------------------------------------------------- |
| `ui-compliance.sh` | PreToolUse: Edit/Write | Warnt bei nativen Elementen, fehlendem bg-card, kleinen Touch-Targets |
| `schema-gate.sh`   | PreToolUse: Bash       | Warnt wenn `prisma migrate` ohne `schema-analyzer`                    |
| `completeness.sh`  | Stop                   | Warnt bei offenen todo.md Items, unformatierten Dateien               |

---

## Kernregeln

1. **Server Actions** statt API Routes für Formularaktionen
2. **Kein `any`** — TypeScript strict
3. **Kein userId-Filter** auf Vereinsdaten — Auth via Rolle (ADMIN/USER)
4. **Archivieren statt Löschen** bei Daten mit Abhängigkeiten (Ausnahme: Admin Force-Delete)
5. **shadcn/ui** für alle UI-Elemente — keine nativen Browser-Dialoge

## Feature-Reihenfolge

Schema → Migration → Types → Queries → Actions → Calculate → Components → Page → Prettier → `/check` → Docs

## Referenzimplementierung

**Lokal:** `/Users/christian/repos/treffsicher` (bevorzugt)

| Datei                     | Referenz für                       |
| ------------------------- | ---------------------------------- |
| `src/lib/auth.ts`         | NextAuth authOptions               |
| `src/lib/db.ts`           | Prisma Client Singleton (Prisma 7) |
| `src/lib/auth-helpers.ts` | getAuthSession()                   |
| `src/proxy.ts`            | Edge-Auth (Next.js 16)             |
| `src/lib/disciplines/`    | Feature-Modul-Muster               |
| `prisma/schema.prisma`    | Prisma 7 Schema-Konventionen       |

## Dokumentation (on-demand laden, nicht im Hauptkontext)

| Dokument                      | Laden wenn...                       |
| ----------------------------- | ----------------------------------- |
| `docs/features.md`            | Feature-Scope klären, CLASSIFY      |
| `docs/architecture.md`        | Routen, Verzeichnisstruktur         |
| `docs/technical.md`           | Tech Stack, Prisma 7, Deployment    |
| `docs/data-model.md`          | Berechnungslogik, Entitäten         |
| `docs/code-conventions.md`    | Code schreiben (IMPLEMENT)          |
| `docs/ui-patterns.md`         | UI bauen (IMPLEMENT)                |
| `docs/claude-architecture.md` | Pipeline-Architektur, Request-Guide |
| `tasks/lessons.md`            | Session-Start, FINALIZE             |

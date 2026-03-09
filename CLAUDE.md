# 1-gegen-1 Liga-App – Projektanweisungen

## Session-Start (immer zuerst)

1. `tasks/lessons.md` lesen – Was hat zuletzt nicht funktioniert?
2. `docs/open-issues.md` prüfen – neue offene Fragen?
3. `tasks/todo.md` prüfen – wo war die letzte Session?

## Projektkontext

Vereinsinterne Liga-Verwaltungs-App für 1-gegen-1 Schützenwettkämpfe.
→ Features: `docs/features.md`
→ Architektur: `docs/architecture.md`
→ Technisch: `docs/technical.md`
→ Datenmodell: `docs/data-model.md`
→ Code Conventions: `docs/code-conventions.md`
→ Offene Fragen: `docs/open-issues.md`
→ Aufgaben: `tasks/todo.md`
→ Lernlog: `tasks/lessons.md`

---

## Agents & Commands

### Agents (`.claude/agents/`) — isolierter Kontext, parallel einsetzbar

| Agent              | Wann einsetzen                                                                       |
| ------------------ | ------------------------------------------------------------------------------------ |
| `plan-change`      | ⛔ **Pflicht** vor jeder Änderung an einem bestehenden Feature – auf Bericht warten  |
| `schema-guard`     | ⛔ **Pflicht** vor jeder Prisma-Migration – auf Bericht warten, dann erst `/migrate` |
| `feature-scaffold` | Neues Feature beginnen – alle Layer-Skelette generieren (Schritte 3–8)               |
| `action-audit`     | Nach neuen Actions oder als Qualitätscheck (Auth-Pattern)                            |
| `test-scaffold`    | Nach neuer `calculate*.ts` oder `actions.ts` – Tests generieren                      |
| `prettier-fix`     | Nach jeder Dateiänderung starten – vor `/check`                                      |
| `docs-sync`        | Nach Feature-Abschluss starten – README + docs/ aktuell halten                       |

### Commands (`.claude/commands/`) — laufen im Hauptkontext

| Command          | Wann einsetzen                                           |
| ---------------- | -------------------------------------------------------- |
| `check`          | Vor jedem Commit – alle 4 Gates: Lint, Format, Test, TSC |
| `test`           | Schneller Feedback-Loop während Entwicklung              |
| `migrate <name>` | Nach Schema-Änderung in `prisma/schema.prisma`           |
| `commit-msg`     | Commit-Message aus Diff generieren                       |
| `seed`           | Nach `db-reset` – Admin + Systemdisziplinen anlegen      |
| `db-reset`       | Dev-DB vollständig zurücksetzen                          |

---

## Workflow

### 1. Plan zuerst

- Bei jeder nicht-trivialen Aufgabe (≥3 Schritte / Architektur-Entscheidung): Planmodus aktivieren
- Plan nach `tasks/todo.md` schreiben mit abhakbaren Items, vor Implementierung kurz bestätigen lassen
- Bei unerwartetem Verhalten: sofort stoppen, neu planen – nicht weiter drücken
- Planmodus auch für Verifikation nutzen, nicht nur für Entwicklung
- **Änderung an bestehendem Feature?** → ⛔ STOPP: `plan-change`-Agent starten, auf Bericht warten, dann erst implementieren

### 2. Subagenten einsetzen

- Exploration, Recherche und parallele Analyse an Subagenten auslagern
- Hauptkontext sauber halten – ein Thema pro Subagent
- Bei komplexen Problemen: mehr Compute via Subagenten
- **Verfügbare Agents:** Tabelle direkt oben – proaktiv einsetzen, nicht nur auf Anfrage

### 3. Selbst-Verbesserung

- Nach jeder Korrektur durch den Nutzer: Muster in `tasks/lessons.md` festhalten
- Regeln ableiten, die denselben Fehler verhindern
- Zu Sessionbeginn relevante Lessons lesen

### 4. Verifikation vor „Done"

- Aufgabe erst abschliessen, wenn Korrektheit nachweisbar ist
- Tests laufen lassen, Logs prüfen, Verhalten demonstrieren
- Frage stellen: „Würde ein Senior Engineer das so abnicken?"

### 5. Eleganz einfordern

- Bei nicht-trivialen Änderungen: kurz pausieren und fragen „Gibt es einen eleganteren Weg?"
- Hacky Lösung erkannt? → „Implementiere die elegante Lösung mit allem Wissen, das ich jetzt habe"
- Einfache, offensichtliche Fixes: nicht überentwickeln

### 6. Bugs autonom lösen

- Fehlerbericht erhalten → einfach lösen, nicht nachfragen
- Logs, Errors, fehlschlagende Tests sind Hinweise – auflösen, nicht umgehen
- Kein Kontextwechsel für den Nutzer nötig

---

## Aufgabenverwaltung

1. **Planen** → `tasks/todo.md` mit Checkboxen befüllen
2. **Abstimmen** → kurz bestätigen lassen, dann implementieren
3. **Fortschritt tracken** → Items direkt nach Abschluss abhaken
4. **Änderungen erklären** → High-Level-Zusammenfassung je Schritt
5. **Ergebnisse dokumentieren** → Review-Abschnitt in `tasks/todo.md`
6. **Lessons festhalten** → `tasks/lessons.md` nach Korrekturen aktualisieren

---

## Kernprinzipien

- **Einfachheit zuerst** – minimaler Impact, nur das Nötige ändern
- **Kein Herumdoktern** – Ursachen finden, keine temporären Workarounds
- **Minimaler Footprint** – nur berühren, was notwendig ist; keine Bugs einschleppen
- **Kein `any`** – TypeScript strict, immer
- **Kein userId-Filter auf gemeinsamen Daten** – Ligen, Teilnehmer, Disziplinen sind vereinsweit; Auth via Rolle, nicht via userId (→ Details in `docs/schema-draft.prisma` Kommentare)
- **Server Actions statt API Routes** für alle Formularaktionen
- **Archivieren statt Löschen** – bei Objekten mit abhängigen Daten

---

## Referenzimplementierung

Bei Implementierungen immer zuerst treffsicher als Vorlage konsultieren:
**Lokal:** `/Users/christian/repos/treffsicher` (bevorzugt — kein Netzwerk-Lookup)
**GitHub:** https://github.com/cykedev/treffsicher

| Datei                                     | Referenz für                                                    |
| ----------------------------------------- | --------------------------------------------------------------- |
| `src/lib/auth.ts`                         | NextAuth authOptions (Credentials Provider, JWT, Session)       |
| `src/lib/db.ts`                           | Prisma Client Singleton (adapter-pg, Prisma 7)                  |
| `src/lib/startup.ts`                      | runStartup() – erster App-Start, Admin + System-Disziplinen     |
| `src/lib/auth-helpers.ts`                 | getAuthSession()                                                |
| `src/lib/auth-rate-limit/`                | Login-Rate-Limiting (In-Memory-Buckets)                         |
| `src/proxy.ts`                            | Edge-Auth via withAuth (proxy.ts = middleware.ts in Next.js 16) |
| `src/app/api/auth/[...nextauth]/route.ts` | NextAuth Route Handler                                          |
| `src/app/(app)/layout.tsx`                | Layout-basierter Auth-Guard                                     |
| `src/lib/disciplines/`                    | Muster für Feature-Modul (actions + queries + types)            |
| `prisma/schema.prisma`                    | Prisma 7 Schema-Konventionen                                    |

---

## README.md – Pflicht

`README.md` muss nach jeder relevanten Änderung aktualisiert werden:

- Neues Feature fertiggestellt → Projektstruktur und ggf. Konfigurationstabelle anpassen
- Neue Umgebungsvariable → in der Konfigurationstabelle eintragen
- Setup-Schritte ändern sich → Abschnitt „Erste Inbetriebnahme" anpassen
- Neuer Agent → in der Agents-Tabelle in CLAUDE.md und README ergänzen

Faustregel: Wenn ein neuer Entwickler nach dem README die App nicht zum Laufen bringen kann, ist es nicht aktuell genug.
→ Nach Feature-Abschluss: `docs-sync`-Agent starten.

---

## Feature-Implementierung

Reihenfolge für jedes neue Feature (niemals überspringen):

1. **Schema** → `prisma/schema.prisma` ergänzen (model + enum)
   ⛔ STOPP: `schema-guard`-Agent starten – auf Bericht warten – dann erst weiter
2. **Migration** → `/migrate`-Command ausführen
3. **Types** → `src/lib/<feature>/types.ts`
4. **Queries** → `src/lib/<feature>/queries.ts` (nur Lesen, keine Mutationen)
5. **Actions** → `src/lib/<feature>/actions.ts` (Auth → Rolle → Validierung → DB)
6. **Berechnung** → `src/lib/<feature>/calculate*.ts` – `test-scaffold`-Agent starten
7. **Komponenten** → `src/components/app/<feature>/`
8. **Page** → `src/app/(app)/<route>/page.tsx` (dünner Orchestrator)
9. **Format** → `prettier-fix`-Agent starten – auf Abschluss warten
10. **Verifikation** → `/check`-Command (Lint + Format + Test + TSC) – alle Gates grün
11. **Docs** → `docs-sync`-Agent starten

**Neues Feature beginnen?** → ⛔ `feature-scaffold`-Agent für Schritte 3–8 starten.
**Bestehendes Feature ändern?** → ⛔ STOPP: `plan-change`-Agent **vor** Schritt 1 starten, auf Bericht warten.

# Claude-Architektur: Pipeline, Agents, Hooks

Dieses Dokument beschreibt die Workflow-Architektur für die Zusammenarbeit mit Claude Code in diesem Projekt.

---

## Designprinzip: 4 Schichten

Die Architektur verteilt Wissen auf 4 Schichten, die nur bei Bedarf geladen werden:

| Schicht       | Kontextkosten | Enforcement | Wann geladen                   |
| ------------- | :-----------: | :---------: | ------------------------------ |
| **Hooks**     |       0       | Automatisch | Nie im Kontext — Shell-Scripts |
| **CLAUDE.md** |     Immer     |  Advisory   | Session-Start — minimal halten |
| **Agents**    |   Isoliert    |  Parallel   | Eigener Kontext pro Agent      |
| **Docs**      |   On-demand   |  Referenz   | Nur wenn Feature sie braucht   |

**Kernidee:** Regeln als Code (Hooks) statt als Text (CLAUDE.md). Jede Regel, die als Hook durchgesetzt werden kann, braucht keinen Platz im Hauptkontext.

---

## Pipeline: 4 Stages

```
REQUEST → CLASSIFY → ANALYZE → PLAN → EXECUTE
```

### Stage 1: CLASSIFY

**Wer:** Opus (Hauptkontext)
**Was:** Jeden Request klassifizieren bevor etwas anderes passiert.

5 Klassen:

- **NEW_PLANNED** — Bekanntes/geplantes Feature
- **NEW_UNKNOWN** — Neue, ungeplante Anforderung
- **MODIFICATION** — Änderung an bestehendem Feature
- **BUGFIX** — Fehler beheben
- **MAINTENANCE** — Docs, Refactoring, Config

### Stage 2: ANALYZE

**Wer:** Spezialisierte Agenten, parallel, isolierter Kontext
**Was:** Je nach Klasse unterschiedliche Agenten starten.

| Agent             | NEW_PLANNED | NEW_UNKNOWN | MODIFICATION |   BUGFIX   | MAINTENANCE |
| ----------------- | :---------: | :---------: | :----------: | :--------: | :---------: |
| `impact-analyzer` |      –      |      –      |   Pflicht    |  optional  |      –      |
| `ui-compliance`   |   Pflicht   |   Pflicht   |   Pflicht    | bei UI-Bug |      –      |
| `codebase-scout`  |   Pflicht   |   Pflicht   |   Pflicht    |  Pflicht   |      –      |
| `schema-analyzer` |   bei DB    |   bei DB    |    bei DB    |     –      |      –      |

### Stage 3: PLAN

**Wer:** Opus (Hauptkontext)
**Was:** Agenten-Reports zusammenführen → Plan erstellen → Freigabe einholen.

1. Reports konsolidieren
2. Hinterfragen: besserer Weg?
3. Rückfragen bei Unklarheiten
4. Plan in `tasks/todo.md`
5. **Manuelle Freigabe abwarten**

### Stage 4: EXECUTE

**Eine zusammenhängende Phase — alle Schritte abarbeiten, erst dann ist die Aufgabe fertig.**

**Implementieren:**

- `feature-builder` (model: **sonnet**) — Code
- `test-writer` (model: **sonnet**) — Tests
- Layer-Reihenfolge: Schema → Types → Queries → Actions → Calculate → Components → Page

**Qualität sichern:**

- Prettier ausführen
- `/check` — Lint, Format, Test, TSC
- `action-audit` (model: **haiku**) auf Actions
- Preview bei UI-Änderungen

**Abschliessen (Pflicht — nicht optional):**

- `docs-sync` (model: **haiku**) — README, features.md
- `lessons-check` (model: **haiku**) — Lernlog
- `/commit-msg` — Commit-Message

**Die Aufgabe ist NICHT fertig, solange "Abschliessen" nicht durchgelaufen ist.**

---

## Agents: Katalog

### Analyse-Agenten (ANALYZE, model: opus)

**`impact-analyzer`**
Analysiert Änderungen an bestehenden Features: Ripple-Effekte, Migrations-Risiken, betroffene Dateien, Seiteneffekte auf andere Features. Erstellt eine Risiko-Bewertung und den minimalen Footprint.

**`ui-compliance`**
Prüft Komponenten gegen `docs/ui-patterns.md`: shadcn/ui-Pflicht, Touch-Targets (≥40px), bg-card, Aktiv/Inaktiv-Trennung, Responsive-Design, Farb-Palette. Gibt Checkliste mit Verstössen aus.

**`codebase-scout`**
Durchsucht die Codebase nach der besten Vorlage für die anstehende Aufgabe. Findet Referenz-Dateien, prüft Wiederverwendbarkeit, schlägt den elegantesten Weg vor.

**`schema-analyzer`**
Prüft Schema-Änderungen: Naming-Konventionen, relationale Integrität, Indizes, Migrationssicherheit, Business-Logic-Kompatibilität. Erstellt `.claude/.schema-analyzed` Marker für den Schema-Gate-Hook.

### Implementierungs-Agenten (EXECUTE — Implementieren, model: sonnet)

**`feature-builder`**
Implementiert Code nach freigegebenem Plan. Liest `code-conventions.md` und `ui-patterns.md`, arbeitet Plan-Items in Layer-Reihenfolge ab.

**`test-writer`**
Generiert domänen-aware Tests: Ringteiler-Formel, Gleichstand-Auflösung, Freilos-Behandlung, Auth-Guard-Tests.

### Qualitäts-Agent (EXECUTE — Qualität sichern, model: haiku)

**`action-audit`**
Prüft Actions auf Auth → Rolle → Validierung → DB Pattern-Konformität.

### Abschluss-Agenten (EXECUTE — Abschliessen, model: haiku)

**`docs-sync`**
Synchronisiert README.md, features.md, CLAUDE.md mit dem Code.

**`lessons-check`**
Prüft ob Korrekturen stattfanden und dokumentiert neue Lessons.

---

## Hooks: Automatische Enforcement

Hooks erzwingen Regeln als Shell-Scripts — **zero context cost**.

### `ui-compliance.sh` (PreToolUse: Edit/Write)

Prüft bei jeder .tsx-Dateiänderung:

- Keine nativen Browser-Dialoge (`confirm`, `alert`, `prompt`)
- Kein `DropdownMenu` in Listenzeilen
- `bg-card` auf Containern mit `rounded-lg border`
- Touch-Targets ≥ `h-10 w-10`
- Kein `toLocaleDateString()` ohne Timezone

**Modus:** Warnung (exit 0), nicht blockierend.

### `schema-gate.sh` (PreToolUse: Bash)

Warnt wenn `prisma migrate` ohne vorherigen `schema-analyzer`-Lauf ausgeführt wird.
Prüft auf Marker-Datei `.claude/.schema-analyzed`.

**Modus:** Warnung (exit 0), nicht blockierend.

### `completeness.sh` (Stop)

Prüft bei Session-Ende:

- Offene Items in `tasks/todo.md`
- Uncommittete .ts/.tsx-Änderungen → erinnert an EXECUTE-Checkliste:
  - `/check` ausgeführt?
  - `action-audit` auf Actions?
  - `docs-sync` (README, features.md)?
  - `lessons-check` (neue Erkenntnisse)?
  - `/commit-msg` für Commit-Message?

**Modus:** Warnung (exit 0), nicht blockierend.

---

## Modellzuweisung

| Phase                                  | model:     | Begründung                                |
| -------------------------------------- | ---------- | ----------------------------------------- |
| Hauptkontext (CLASSIFY, PLAN, EXECUTE) | **Opus**   | Architektur-Entscheidungen, Hinterfragung |
| ANALYZE-Agenten                        | **opus**   | Tiefe Codebase-Analyse                    |
| EXECUTE — Implementierungs-Agenten     | **sonnet** | Code-Generierung, Pattern-Kopie           |
| EXECUTE — Qualitäts-/Abschluss-Agenten | **haiku**  | Schnelle Pattern-Checks                   |

**Wichtig:** Modell beim Agent-Aufruf immer explizit als `model`-Parameter angeben!

---

## Anfragen korrekt formulieren

### NEW_PLANNED — Bekanntes Feature implementieren

Bezug auf `features.md` oder `todo.md` herstellen:

```
"Implementiere das Meyton-Import Feature wie in features.md beschrieben."
"Baue die Schiedsrichter-Rolle aus dem SRS."
"Nächstes Feature aus der todo.md."
```

### NEW_UNKNOWN — Neue Anforderung

Klar als neu kennzeichnen:

```
"Ich hätte gerne eine Statistik-Seite für Teilnehmer."
"Können wir einen CSV-Export für Ergebnisse hinzufügen?"
"Neue Idee: Benachrichtigungen wenn Ergebnisse eingetragen werden."
```

### MODIFICATION — Bestehendes ändern

Bestehendes Feature + gewünschte Änderung benennen:

```
"Ändere die Playoff-Qualifikation von Top 4/8 auf Top 6."
"Die Tabellensortierung soll zuerst nach Ringteiler gehen statt nach Punkten."
"Füge der Liga-Bearbeitung ein optionales Beschreibungsfeld hinzu."
```

### BUGFIX — Fehler melden

Fehlerbeschreibung, idealerweise mit Kontext:

```
"Die Standings-Berechnung zeigt falsche Punkte bei Freilos."
"Auf Mobile werden die Playoff-Karten abgeschnitten."
"Fehler: Beim Rückzug eines Teilnehmers crasht die Seite."
```

Auch akzeptiert: Screenshots, Fehlermeldungen, Stack-Traces.

### MAINTENANCE — Aufräumen

Klar als Wartungsaufgabe formulieren:

```
"Aktualisiere die README mit dem neuen Feature."
"Refactore calculateStandings — die Funktion ist zu lang."
"Räume die unused Imports in src/lib/ auf."
```

---

## Kontext-Effizienz

### Was CLAUDE.md enthält (immer geladen)

- Pipeline-Definition (4 Stages)
- Klassifikationsregeln
- Agent-/Command-/Hook-Katalog (Tabellen)
- 5 Kernregeln
- Feature-Reihenfolge
- Referenzimplementierung
- Dokumentations-Index

### Was NICHT in CLAUDE.md steht (on-demand laden)

| Dokument                   | Wann laden                            |
| -------------------------- | ------------------------------------- |
| `docs/features.md`         | CLASSIFY — Scope prüfen               |
| `docs/architecture.md`     | Routen, Verzeichnisstruktur verstehen |
| `docs/technical.md`        | Prisma 7, Deployment, Auth            |
| `docs/data-model.md`       | Berechnungslogik implementieren       |
| `docs/code-conventions.md` | IMPLEMENT — Code schreiben            |
| `docs/ui-patterns.md`      | IMPLEMENT — UI bauen                  |
| `tasks/lessons.md`         | Session-Start (letzte 5), FINALIZE    |

Die Agenten laden ihren Kontext selbstständig und belasten den Hauptkontext nicht.

---

## Dateien-Übersicht

```
.claude/
├── settings.json              ← Hooks-Konfiguration
├── settings.local.json        ← Lokale Permissions (nicht eingecheckt)
├── hooks/
│   ├── ui-compliance.sh       ← PreToolUse: UI-Pattern-Warnung
│   ├── schema-gate.sh         ← PreToolUse: Migration-Gate
│   └── completeness.sh        ← Stop: Vollständigkeits-Check
├── agents/
│   ├── impact-analyzer.md     ← ANALYZE: Ripple-Analyse
│   ├── ui-compliance.md       ← ANALYZE: UI-Pattern-Check
│   ├── codebase-scout.md      ← ANALYZE: Referenz-Finder
│   ├── schema-analyzer.md     ← ANALYZE: Schema-Validierung
│   ├── feature-builder.md     ← IMPLEMENT: Code bauen
│   ├── test-writer.md         ← IMPLEMENT: Tests bauen
│   ├── action-audit.md        ← VERIFY: Auth-Pattern-Audit
│   ├── docs-sync.md           ← FINALIZE: Docs synchronisieren
│   └── lessons-check.md       ← FINALIZE: Lernlog aktualisieren
├── commands/
│   ├── check.md               ← Lint + Format + Test + TSC
│   ├── test.md                ← Nur Vitest
│   ├── migrate.md             ← Prisma-Migration
│   ├── commit-msg.md          ← Commit-Message generieren
│   ├── seed.md                ← DB seeden
│   └── db-reset.md            ← Dev-DB zurücksetzen
└── launch.json                ← Docker Dev-Server
```

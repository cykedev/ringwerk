# Lernlog – Liga-App

Wird nach jeder Nutzerkorrektur aktualisiert.
Format: Datum | Fehler | Regel die ihn verhindert

---

| 2026-03-09 | Punktevergabe mit 3 statt 2 dokumentiert; Unentschieden-Regelung fehlte komplett | Vor dem Dokumentieren von Spielregeln explizit nachfragen statt SRS-Defaults übernehmen |
| 2026-03-09 | Projekt-Setup: `postcss.config.mjs` vergessen → `shadcn/tailwind.css` und `tw-animate-css` nicht auflösbar | Bei Tailwind 4 + shadcn immer `postcss.config.mjs` mit `@tailwindcss/postcss` anlegen — ohne diese Datei schlägt die CSS-Auflösung im Dev-Server fehl |
| 2026-03-09 | DB-Port 5432 bei parallelen Projekten belegt → Docker `up` schlägt fehl | In `docker-compose.dev.yml` den extern gemappten Port projektspezifisch wählen (1gegen1: 5433, treffsicher: 5432) |
| 2026-03-09 | `z.string().optional()` akzeptiert kein `null` — `FormData.get()` liefert `null` für fehlende Felder | Optionale FormData-Felder immer mit `z.string().nullable().optional()` validieren; `parseDeadline` mit `string \| null \| undefined` typisieren |
| 2026-03-09 | Prettier beanstandete lange Zeilen in neu generierten Dateien (gleicher Fehler zweimal) | Nach jeder neuen Datei lokal `npx prettier --write <datei>` ausführen, bevor der Docker-Check läuft — spart einen Round-Trip |
| 2026-03-09 | `prompt()` gibt `null` zurück wenn Nutzer abbricht; `?? ""` würde `null` in `""` wandeln und Cancel ignorieren | Bei `prompt()`-Rückgabewert zuerst `if (result === null) return` prüfen, dann erst den Wert verwenden |
| 2026-03-09 | Prisma-Relation `leagueParticipants` im Nested-Select verwendet, obwohl das Feld im Schema `leagues LeagueParticipant[]` heisst → `PrismaClientValidationError: Unknown field 'leagueParticipants'` | Vor jedem Nested-Select den exakten Relationsnamen aus `schema.prisma` ablesen — der Feldname auf dem Model (nicht der Typ) ist der korrekte Select-Key |

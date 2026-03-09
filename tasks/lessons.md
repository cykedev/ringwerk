# Lernlog – Liga-App

Wird nach jeder Nutzerkorrektur aktualisiert.
Format: Datum | Fehler | Regel die ihn verhindert

---

| 2026-03-09 | Punktevergabe mit 3 statt 2 dokumentiert; Unentschieden-Regelung fehlte komplett | Vor dem Dokumentieren von Spielregeln explizit nachfragen statt SRS-Defaults übernehmen |
| 2026-03-09 | Projekt-Setup: `postcss.config.mjs` vergessen → `shadcn/tailwind.css` und `tw-animate-css` nicht auflösbar | Bei Tailwind 4 + shadcn immer `postcss.config.mjs` mit `@tailwindcss/postcss` anlegen — ohne diese Datei schlägt die CSS-Auflösung im Dev-Server fehl |
| 2026-03-09 | DB-Port 5432 bei parallelen Projekten belegt → Docker `up` schlägt fehl | In `docker-compose.dev.yml` den extern gemappten Port projektspezifisch wählen (1gegen1: 5433, treffsicher: 5432) |

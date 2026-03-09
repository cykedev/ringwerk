# Aufgaben-Log – Liga-App

---

## Aktuell

<!-- Aktive Planung hier eintragen -->

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

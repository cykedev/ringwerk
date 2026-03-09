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

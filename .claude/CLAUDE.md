# Ringwerk — Claude Configuration

**Sprache:** Alle Kommunikation mit dem User auf Deutsch. Code, Commit-Messages und Agent-Prompts bleiben auf Englisch.

## Hard Rules (non-negotiable, always active)

1. **NEVER create a git commit.** The user commits manually. Not under any circumstances.
2. **Commit messages MUST be displayed as a fenced code block** so the user can copy them easily.
3. **Finalize is mandatory** — if the user gives feedback or asks questions mid-implementation, incorporate them and still complete all wrap-up steps (lessons, commit-msg). Nothing may be left pending.

---

## Session Start

1. Read `.claude/docs/project-brief.md`
2. Read last 5 entries of `.claude/tasks/lessons.md`
3. Brief German onboarding message: "Alles klar" or any relevant context from lessons

---

## Project Context

- **Name:** Ringwerk
- **Quality command:** `/check` — runs via `docker compose -f docker-compose.dev.yml run --rm app`:
  - `npm run lint`
  - `npm run format:check`
  - `npm run test`
  - `npx tsc --noEmit`
- **Layer order** (follow when implementing schema changes):
  Schema → Migration → Types → Queries → Actions → Calculate → Components → Page

### Compliance Rules (apply to all `.tsx` files)

1. No `window.confirm` / `alert` / `prompt` — use the project's dialog component
2. No `DropdownMenu` — use inline icon buttons in list rows
3. `rounded-lg border` without `bg-card` breaks dark mode — always add `bg-card`
4. Icon buttons: minimum `h-10 w-10`, never `h-8 w-8`
5. No bare `toLocaleDateString()` — use the project's date formatter

---

## Docs (load on-demand)

| Key | Path | Load when |
|-----|------|-----------|
| `projectBrief` | `.claude/docs/project-brief.md` | Session start |
| `features` | `.claude/docs/features.md` | Clarifying feature scope |
| `architecture` | `.claude/docs/architecture.md` | Routes, directory structure |
| `techStack` | `.claude/docs/technical.md` | Stack details, deployment |
| `domainModel` | `.claude/docs/data-model.md` | Business logic, formulas |
| `codeConventions` | `.claude/docs/code-conventions.md` | Writing code |
| `uiPatterns` | `.claude/docs/ui-patterns.md` | Building UI |
| `referenceFiles` | `.claude/docs/reference-files.md` | Finding patterns, templates |

---

## Superpowers Workflow

Use superpowers skills for all development work:

| Task type | Skill sequence |
|-----------|----------------|
| New feature / change | `brainstorming` → `writing-plans` → `subagent-driven-development` |
| Bug | `systematic-debugging` |
| Branch completion | `finishing-a-development-branch` |
| Parallel independent tasks | `dispatching-parallel-agents` |
| Requesting review | `requesting-code-review` |
| Receiving review | `receiving-code-review` |

---

## Commands

| Command | When |
|---------|------|
| `/check` | Before every commit — all quality gates |
| `/test` | Quick feedback — tests only |
| `/migrate <name>` | After schema change |
| `/seed` | After `/db-reset` |
| `/db-reset` | Reset dev database |
| `/commit-msg` | Generate commit message from diff |
| `/consolidate-lessons` | Compress lessons, promote rules to docs |

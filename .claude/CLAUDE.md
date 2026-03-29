# Ringwerk — Claude Configuration

**Sprache:** Alle Kommunikation mit dem User auf Deutsch. Code, Commit-Messages und Agent-Prompts bleiben auf Englisch.

## Hard Rules (non-negotiable, always active)

1. **Feature branches are mandatory.** Every new feature/session starts on a new branch. Propose a name (`feat/<topic>`), wait for user confirmation, then `git checkout -b`.
2. **Never commit directly to `main`.** All commits go on the feature branch.
3. **Never rebase or merge to `main` without explicit user confirmation.**
4. **Commit messages must never include `Co-Authored-By` lines.** No attribution trailers of any kind.
5. **Commit messages MUST be displayed as a fenced code block** before committing, so the user can review them.
6. **Finalize is mandatory** — if the user gives feedback or asks questions mid-implementation, incorporate them and still complete all wrap-up steps. Nothing may be left pending.

---

## Branch & Commit Workflow

### Starting a session

1. Propose a branch name (`feat/<topic>`) and wait for user confirmation.
2. `git checkout -b feat/<topic>`
3. Commit spec + plan files as the first commit on the branch (before implementation starts).

### During implementation

- **Subagents** commit after each task — one small, focused commit per task.
- **Main agent** commits: checklist/review-plan updates, formatting housekeeping.
- Every commit that changes behavior must include its tests in the same commit.
- Plans must contain explicit test steps (new tests + updates to existing test mocks).

### Completing a session

- Run `/check` — all gates must be green.
- Present a summary of all commits on the branch.
- Merge to `main` with `git merge --ff-only` (no merge commit), then delete the branch with `git branch -d`.

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

| Key               | Path                               | Load when                   |
| ----------------- | ---------------------------------- | --------------------------- |
| `projectBrief`    | `.claude/docs/project-brief.md`    | Session start               |
| `features`        | `.claude/docs/features.md`         | Clarifying feature scope    |
| `architecture`    | `.claude/docs/architecture.md`     | Routes, directory structure |
| `techStack`       | `.claude/docs/technical.md`        | Stack details, deployment   |
| `domainModel`     | `.claude/docs/data-model.md`       | Business logic, formulas    |
| `codeConventions` | `.claude/docs/code-conventions.md` | Writing code                |
| `uiPatterns`      | `.claude/docs/ui-patterns.md`      | Building UI                 |
| `referenceFiles`  | `.claude/docs/reference-files.md`  | Finding patterns, templates |
| `worktrees`       | `.claude/docs/worktrees.md`        | Before using git worktrees  |

---

## Superpowers Docs Location

All superpowers artifacts (specs, plans) MUST be saved under `.claude/docs/superpowers/`:

- Specs → `.claude/docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`
- Plans → `.claude/docs/superpowers/plans/YYYY-MM-DD-<topic>-plan.md`

Never write these to `docs/` at the project root.

---

## Superpowers Workflow

Use superpowers skills for all development work:

| Task type                  | Skill sequence                                                    |
| -------------------------- | ----------------------------------------------------------------- |
| New feature / change       | `brainstorming` → `writing-plans` → `subagent-driven-development` |
| Bug                        | `systematic-debugging`                                            |
| Branch completion          | `finishing-a-development-branch`                                  |
| Parallel independent tasks | `dispatching-parallel-agents`                                     |
| Requesting review          | `requesting-code-review`                                          |
| Receiving review           | `receiving-code-review`                                           |

---

## Commands

| Command                | When                                    |
| ---------------------- | --------------------------------------- |
| `/check`               | Before every commit — all quality gates |
| `/test`                | Quick feedback — tests only             |
| `/migrate <name>`      | After schema change                     |
| `/seed`                | After `/db-reset`                       |
| `/db-reset`            | Reset dev database                      |
| `/commit-msg`          | Generate commit message from diff       |
| `/consolidate-lessons` | Compress lessons, promote rules to docs |

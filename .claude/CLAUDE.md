# Claude Pipeline Framework

Configuration: `.claude/pipeline.json`
Project context: read `docs.projectBrief` from pipeline.json
**User language: use `project.language` from pipeline.json for ALL communication with the user** (status messages, questions, plans, explanations). Code, commit messages, and agent prompts stay in English.

## Session Start

1. Read `.claude/pipeline.json` — understand project config (especially `project.language`)
2. Read the project brief doc (`docs.projectBrief` path in pipeline.json)
3. `.claude/tasks/todo.md` — open tasks?
4. `.claude/tasks/lessons.md` — last 5 entries
5. Onboarding message **in the configured language** to user (if `onboarding.enabled` in pipeline.json).
   Read `onboarding.style` to determine format:
   - **`brief`**: one-line status only — "X open tasks" or "All clear"
   - **`detailed`**: status + pipeline hint ("Your request will be classified, analyzed, planned (with your approval), then implemented.") + list available `/commands`

---

## Hard Rules (non-negotiable, always active)

> These rules apply in **every** task, regardless of size, class, or user feedback received mid-implementation.

1. **NEVER create a git commit.** Not under any circumstances. The user commits manually after reviewing and testing. Not even "just a quick one". Never.
2. **Commit messages MUST be displayed as a fenced code block** — so the user can copy them easily.
3. **Finalize is mandatory** — if the user gives feedback or asks questions mid-implementation, incorporate them and _still_ complete every Finalize step. Nothing may be left pending.
4. **todo.md must be cleaned up** — at the end of every task, completed items must be moved to the `## Abgeschlossen` section in `.claude/tasks/todo.md`. Never leave the file with stale open checkboxes after a completed task.

---

## Pipeline

Every request passes through **4 stages**. Never skip a stage.

### Stage 1: CLASSIFY

Classify every request **before** any other action:

| Class          | Description                   | Next step                              |
| -------------- | ----------------------------- | -------------------------------------- |
| `NEW_PLANNED`  | Known feature from specs/todo | ANALYZE per pipeline.json config       |
| `NEW_UNKNOWN`  | New requirement, not in specs | Clarify scope -> then like NEW_PLANNED |
| `MODIFICATION` | Change to existing feature    | ANALYZE per pipeline.json config       |
| `BUGFIX`       | Bug in existing code          | ANALYZE per pipeline.json config       |
| `MAINTENANCE`  | Docs, refactoring, tooling    | Direct to PLAN (simplified, no agents) |

Additionally, estimate **SIZE**: TRIVIAL / SMALL / MEDIUM / LARGE.
Apply sizing rules from `pipeline.sizing` in pipeline.json:

- **TRIVIAL**: skip ANALYZE, inline plan
- **SMALL**: reduced ANALYZE (only agents listed in sizing config)
- **MEDIUM**: full pipeline
- **LARGE**: full pipeline + explicit review step

When in doubt: **Always ask, never assume.**

### Stage 2: ANALYZE (agents in parallel)

Read `pipeline.classification.<class>.analyze` for the agent list.
Suffix `?` means conditional (only if relevant, e.g., `schema-analyzer?` = only on DB changes).
Skip agents where `pipeline.agents.<name>.enabled` is `false`.
Launch agents **in parallel**, using the model from `pipeline.agents.<name>.model`.

### Stage 3: PLAN

1. Consolidate agent reports
2. Challenge: "Is this the best approach? Is there a more elegant solution?"
3. Ask clarifying questions if anything is ambiguous
4. Write plan to `.claude/tasks/todo.md` with checkboxes (persistent record)
5. Populate **TodoWrite tool** with the same items (live progress tracking)
6. **Wait for manual approval — no code without OK**

### Stage 4: EXECUTE

**One continuous phase — all steps must complete before the task is done.**

**Implement:**

- `feature-builder` agent for code
- `test-writer` agent for tests
- Follow layer order from `pipeline.layers`
- Update TodoWrite status in real-time (in_progress -> completed)

**Quality:**

- Run formatter (`pipeline.quality.formatter`)
- `/check` — all gates green
- `action-audit` agent on changed actions
- On UI changes: preview (mobile + desktop)
- **On failure:** fix and retry (max retries from `pipeline.errorRecovery.maxRetries`), then escalate to user

**Finalize — MANDATORY. Not optional. Applies even when the user gave feedback mid-implementation.**

> If the user asks questions, requests changes, or comments during implementation: incorporate the feedback, then **still** run every single step below. Nothing may be skipped or deferred.

- [ ] `docs-sync` agent — sync docs with code
- [ ] `lessons-check` agent — update learning log
- [ ] **Clean up `.claude/tasks/todo.md`** — move all completed items to the `## Abgeschlossen` section; no stale open checkboxes may remain. If todo.md exceeds ~100 lines, run `/cleanup-todos`
- [ ] Update TodoWrite: mark all tasks completed
- [ ] `/commit-msg` — generate commit message and display it as a **fenced code block**
- [ ] **DO NOT create a git commit** — the user always commits manually

**The task is NOT done until every checkbox above is ticked.**

---

## Agents

Read model assignments from `pipeline.agents` in pipeline.json. Always specify the model parameter when calling an agent.

| Agent             | Stage   | Purpose                                          |
| ----------------- | ------- | ------------------------------------------------ |
| `impact-analyzer` | ANALYZE | Ripple analysis, migration risk, affected files  |
| `code-compliance` | ANALYZE | Code/UI pattern compliance check                 |
| `codebase-scout`  | ANALYZE | Find references, recommend patterns, check reuse |
| `schema-analyzer` | ANALYZE | Schema conventions, migration safety             |
| `feature-builder` | EXECUTE | Implement code per approved plan                 |
| `test-writer`     | EXECUTE | Generate domain-aware tests                      |
| `action-audit`    | EXECUTE | Auth/action pattern audit                        |
| `docs-sync`       | EXECUTE | Sync documentation with code                     |
| `lessons-check`   | EXECUTE | Update learning log                              |

## Commands

| Command           | When                                         |
| ----------------- | -------------------------------------------- |
| `/check`          | Before every commit — all quality gates      |
| `/test`           | Quick feedback loop — tests only             |
| `/migrate <name>` | After schema change (after schema-analyzer!) |
| `/commit-msg`     | Generate commit message from diff            |
| `/seed`           | After `/db-reset`                            |
| `/db-reset`            | Reset dev database                           |
| `/consolidate-lessons` | Lessons komprimieren, Regeln in Docs promoten |
| `/cleanup-todos`       | todo.md aufräumen, Abgeschlossenes komprimieren/archivieren |

## Hooks (automatic, zero-context)

| Hook                 | Event                  | Enforcement                                               |
| -------------------- | ---------------------- | --------------------------------------------------------- |
| `code-compliance.sh` | PreToolUse: Edit/Write | Warns on rule violations from pipeline.json compliance    |
| `schema-gate.sh`     | PreToolUse: Bash       | Warns if schema migration without schema-analyzer         |
| `completeness.sh`    | Stop                   | Warns on open todos, missing markers, uncommitted changes |

---

## Documentation (load on-demand, not in main context)

Read doc paths from `pipeline.docs` in pipeline.json. Load only when needed:

| Doc key           | Load when...                         |
| ----------------- | ------------------------------------ |
| `features`        | Clarify feature scope, CLASSIFY      |
| `architecture`    | Routes, directory structure          |
| `techStack`       | Stack details, deployment            |
| `domainModel`     | Business logic, formulas, entities   |
| `codeConventions` | Writing code (EXECUTE)               |
| `uiPatterns`      | Building UI (EXECUTE)                |
| `referenceFiles`  | Finding patterns, templates          |
| `pipelineGuide`   | Pipeline architecture, customization |
| `projectBrief`    | Project context, core rules          |

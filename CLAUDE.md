# Claude Pipeline Framework

Configuration: `.claude/pipeline.json`
Project context: read `docs.projectBrief` from pipeline.json
**User language: use `project.language` from pipeline.json for ALL communication with the user** (status messages, questions, plans, explanations). Code, commit messages, and agent prompts stay in English.

## Session Start

1. Read `.claude/pipeline.json` — understand project config (especially `project.language`)
2. Read the project brief doc (`docs.projectBrief` path in pipeline.json)
3. `tasks/todo.md` — open tasks?
4. `tasks/lessons.md` — last 5 entries
5. Brief onboarding message **in the configured language** to user (if `onboarding.enabled` in pipeline.json):
   - Status: "X open tasks" or "All clear"
   - "Your request will be classified, analyzed, planned (with your approval), then implemented."
   - List available `/commands`

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
Launch agents **in parallel**, using the model from `pipeline.agents.<name>.model`.

### Stage 3: PLAN

1. Consolidate agent reports
2. Challenge: "Is this the best approach? Is there a more elegant solution?"
3. Ask clarifying questions if anything is ambiguous
4. Write plan to `tasks/todo.md` with checkboxes (persistent record)
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

**Finalize (mandatory — not optional):**

- `docs-sync` agent — sync docs with code
- `lessons-check` agent — update learning log
- `/commit-msg` for commit message
- Update TodoWrite: all tasks completed

**The task is NOT done until "Finalize" has completed.**

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
| `/db-reset`       | Reset dev database                           |

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

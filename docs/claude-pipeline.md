# Claude Pipeline Framework

A reusable, stack-agnostic framework for structured AI-assisted development with Claude Code.

---

## Overview

The framework provides a **4-stage pipeline** (CLASSIFY -> ANALYZE -> PLAN -> EXECUTE) with specialized agents, automated hooks, and slash commands. All project-specific knowledge is externalized into configuration files, making the framework reusable across any tech stack.

## Architecture: 4 Layers

| Layer         | Context Cost | Enforcement | When Loaded                      |
| ------------- | :----------: | :---------: | -------------------------------- |
| **Hooks**     |      0       |  Automatic  | Never in context — shell scripts |
| **CLAUDE.md** |    Always    |  Advisory   | Session start — keep minimal     |
| **Agents**    |   Isolated   |  Parallel   | Own context per agent            |
| **Docs**      |  On-demand   |  Reference  | Only when feature needs it       |

**Core principle:** Rules as code (hooks) instead of text (CLAUDE.md). Every rule that can be enforced as a hook needs no space in the main context.

---

## Setup for a New Project

### Step 1: Copy Framework Files

Copy the `.claude/` directory structure:

```
.claude/
  pipeline.json              <- Configure for your project
  settings.json              <- Hook wiring (usually unchanged)
  launch.json                <- Dev server config
  hooks/
    session-init.sh          <- Cleans stale markers on new session
    code-compliance.sh       <- Reads rules from pipeline.json
    schema-gate.sh           <- Reads config from pipeline.json
    completeness.sh          <- Reads config from pipeline.json
  agents/
    impact-analyzer.md       <- Generic (reads docs on-demand)
    code-compliance.md       <- Generic (reads docs on-demand)
    codebase-scout.md        <- Generic (reads docs on-demand)
    schema-analyzer.md       <- Generic (reads docs on-demand)
    feature-builder.md       <- Generic (reads docs on-demand)
    test-writer.md           <- Generic (reads docs on-demand)
    action-audit.md          <- Generic (reads docs on-demand)
    docs-sync.md             <- Generic (reads docs on-demand)
    lessons-check.md         <- Generic (reads docs on-demand)
  commands/
    check.md                 <- Reads runner from pipeline.json
    test.md                  <- Reads runner from pipeline.json
    commit-msg.md            <- Generic
    migrate.md               <- Reads config from pipeline.json
    seed.md                  <- Reads config from pipeline.json
    db-reset.md              <- Reads config from pipeline.json
```

Copy `CLAUDE.md` to your project root.

### Step 2: Create pipeline.json

This is the **single source of truth** for all project-specific configuration.

```json
{
  "version": "1.0.0",
  "project": {
    "name": "Your Project Name",
    "brief": "docs/project-brief.md",
    "language": "en"
  },
  "pipeline": {
    "stages": ["CLASSIFY", "ANALYZE", "PLAN", "EXECUTE"],
    "sizing": {
      "TRIVIAL": { "skipAnalyze": true, "inlinePlan": true },
      "SMALL": { "reduceAnalyze": ["codebase-scout"] },
      "MEDIUM": {},
      "LARGE": { "extraReview": true }
    },
    "classification": {
      "NEW_PLANNED": { "analyze": ["codebase-scout", "code-compliance", "schema-analyzer?"] },
      "NEW_UNKNOWN": { "analyze": ["codebase-scout", "code-compliance", "schema-analyzer?"] },
      "MODIFICATION": { "analyze": ["impact-analyzer", "codebase-scout", "code-compliance"] },
      "BUGFIX": { "analyze": ["codebase-scout", "impact-analyzer?"] },
      "MAINTENANCE": { "analyze": [] }
    },
    "errorRecovery": { "maxRetries": 3 }
  },
  "agents": {
    "impact-analyzer": { "model": "opus", "stage": "ANALYZE", "enabled": true },
    "code-compliance": { "model": "opus", "stage": "ANALYZE", "enabled": true },
    "codebase-scout": { "model": "opus", "stage": "ANALYZE", "enabled": true },
    "schema-analyzer": { "model": "opus", "stage": "ANALYZE", "enabled": true },
    "feature-builder": { "model": "sonnet", "stage": "EXECUTE", "enabled": true },
    "test-writer": { "model": "sonnet", "stage": "EXECUTE", "enabled": true },
    "action-audit": { "model": "haiku", "stage": "EXECUTE", "enabled": true },
    "docs-sync": { "model": "haiku", "stage": "EXECUTE", "enabled": true },
    "lessons-check": { "model": "haiku", "stage": "EXECUTE", "enabled": true }
  },
  "quality": {
    "runner": "npm run",
    "gates": [
      { "name": "lint", "command": "lint" },
      { "name": "test", "command": "test" },
      { "name": "typecheck", "command": "tsc --noEmit" }
    ],
    "testOnly": "test",
    "formatter": "npx prettier --write"
  },
  "schema": {
    "tool": "prisma",
    "migrateCommand": "prisma migrate",
    "migrateDevCommand": "npx prisma migrate dev",
    "seedCommand": "npx prisma db seed",
    "markerFile": ".claude/.schema-analyzed"
  },
  "compliance": {
    "filePattern": "\\.tsx\"",
    "rules": []
  },
  "completeness": {
    "markers": [
      ".claude/.action-audit-done",
      ".claude/.docs-sync-done",
      ".claude/.lessons-check-done"
    ],
    "todoFile": "tasks/todo.md",
    "trackedExtensions": [".ts", ".tsx"]
  },
  "docs": {
    "techStack": "docs/tech-stack.md",
    "codeConventions": "docs/code-conventions.md",
    "uiPatterns": "docs/ui-patterns.md",
    "domainModel": "docs/domain-model.md",
    "architecture": "docs/architecture.md",
    "features": "docs/features.md",
    "referenceFiles": "docs/reference-files.md",
    "projectBrief": "docs/project-brief.md",
    "pipelineGuide": "docs/claude-pipeline.md"
  },
  "layers": ["Schema", "Types", "Queries", "Actions", "Components", "Page"],
  "onboarding": { "enabled": true, "style": "brief" }
}
```

### Step 3: Write Project Documentation

Create the docs referenced in `pipeline.docs`. At minimum:

| Doc                   |     Required      | Content                                            |
| --------------------- | :---------------: | -------------------------------------------------- |
| `project-brief.md`    |        Yes        | Project description, core rules, domain language   |
| `code-conventions.md` |        Yes        | Naming, patterns, forbidden constructs, testing    |
| `architecture.md`     |        Yes        | Directory structure, routes, auth strategy         |
| `features.md`         |        Yes        | Feature requirements and implementation status     |
| `tech-stack.md`       |    Recommended    | Stack details, imports, deployment                 |
| `ui-patterns.md`      |       If UI       | Component library rules, responsive, accessibility |
| `domain-model.md`     | If complex domain | Business logic, formulas, entities                 |
| `reference-files.md`  |     Optional      | Reference implementations, template files          |

### Step 4: Create Task Files

```
tasks/
  todo.md       <- Start empty, pipeline writes plans here
  lessons.md    <- Start empty, lessons-check agent populates
```

### Step 5: Add Markers to .gitignore

Completeness markers and the session tracking file are session-scoped and must not be committed:

```gitignore
# Claude pipeline markers (session-scoped, not committed)
.claude/.session-id
.claude/.*-done
.claude/.schema-analyzed
```

### Step 6: Configure Dev Server (launch.json)

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "dev",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "port": 3000
    }
  ]
}
```

---

## Configuration Reference

### pipeline.json Fields

#### `project`

- `name`: Display name for the project
- `brief`: Path to project brief doc
- `language`: User-facing language (de, en, etc.)

#### `pipeline.sizing`

Controls how much pipeline overhead applies per task size:

- `TRIVIAL`: skip ANALYZE, inline plan (no todo.md entry)
- `SMALL`: reduced ANALYZE (only listed agents)
- `MEDIUM`: full pipeline (default)
- `LARGE`: full pipeline + extra review step

#### `pipeline.classification`

Maps request classes to required agents. Suffix `?` means conditional:

- `schema-analyzer?` = only if the task involves schema changes
- `impact-analyzer?` = only if significant impact expected

#### `agents`

- `model`: Which model to use (opus, sonnet, haiku)
- `stage`: Which pipeline stage (ANALYZE or EXECUTE)
- `enabled`: Set to false to disable an agent

#### `quality`

- `runner`: Command prefix for running in the project environment
- `gates`: Array of quality checks, run in order
- `testOnly`: Command to run just tests
- `formatter`: Code formatter command

#### `compliance`

- `filePattern`: Regex to match files in tool input
- `rules[].pattern`: Regex to detect violations
- `rules[].antiPattern`: If present, only warn when pattern matches but antiPattern does NOT
- `rules[].message`: Warning message to display
- `rules[].severity`: "error" or "warning"

#### `completeness`

- `markers`: Files that agents create on completion, checked by stop hook
- `todoFile`: Path to persistent task file
- `trackedExtensions`: File types to watch for uncommitted changes

#### `docs`

Maps logical doc names to file paths. Agents read these paths from pipeline.json.

#### `layers`

Implementation order for the feature-builder agent.

---

## Pipeline Stages

### CLASSIFY

Every request is classified before any action:

| Class          | Description                | Agents                   |
| -------------- | -------------------------- | ------------------------ |
| `NEW_PLANNED`  | Known feature from specs   | Per config               |
| `NEW_UNKNOWN`  | New, unplanned requirement | Clarify, then per config |
| `MODIFICATION` | Change to existing feature | Per config               |
| `BUGFIX`       | Fix existing bug           | Per config               |
| `MAINTENANCE`  | Docs, refactoring, config  | None (direct to PLAN)    |

Additionally, SIZE is estimated: TRIVIAL / SMALL / MEDIUM / LARGE.

### ANALYZE

Specialized agents run in parallel with isolated contexts. Each agent:

1. Reads `.claude/pipeline.json` for project config
2. Reads relevant docs from the configured paths
3. Produces a structured report

### PLAN

The main context:

1. Consolidates agent reports
2. Challenges the approach
3. Writes plan to `tasks/todo.md` (persistent)
4. Populates TodoWrite tool (live progress)
5. Waits for user approval

### EXECUTE

One continuous phase with three sub-phases:

**Implement** -> **Quality** -> **Finalize**

Error recovery: on quality gate failure, fix and retry (max retries from config).

Agents set marker files on completion. The completeness hook verifies these at session end.

---

## Agents

### ANALYZE Agents (model: opus)

| Agent             | Purpose                           | Reads                          |
| ----------------- | --------------------------------- | ------------------------------ |
| `impact-analyzer` | Ripple analysis for modifications | architecture, project brief    |
| `code-compliance` | Pattern/convention compliance     | code conventions, UI patterns  |
| `codebase-scout`  | Find best templates and patterns  | architecture, reference files  |
| `schema-analyzer` | Schema change safety              | domain model, code conventions |

### EXECUTE Agents (model: sonnet)

| Agent             | Purpose                     | Reads                                     |
| ----------------- | --------------------------- | ----------------------------------------- |
| `feature-builder` | Implement code per plan     | code conventions, UI patterns, tech stack |
| `test-writer`     | Generate domain-aware tests | domain model, code conventions            |

### EXECUTE Agents (model: haiku)

| Agent           | Purpose             | Sets Marker                   |
| --------------- | ------------------- | ----------------------------- |
| `action-audit`  | Auth/pattern audit  | `.claude/.action-audit-done`  |
| `docs-sync`     | Sync docs with code | `.claude/.docs-sync-done`     |
| `lessons-check` | Update learning log | `.claude/.lessons-check-done` |

---

## Hooks

All hooks are **non-blocking** (exit 0) and read their configuration from `pipeline.json`.

| Hook                 | Event                  | What it does                                            |
| -------------------- | ---------------------- | ------------------------------------------------------- |
| `session-init.sh`    | UserPromptSubmit       | Cleans stale markers on new session (PID-based)         |
| `code-compliance.sh` | PreToolUse: Edit/Write | Checks file content against compliance rules            |
| `schema-gate.sh`     | PreToolUse: Bash       | Warns if migration runs without schema-analyzer         |
| `completeness.sh`    | Stop                   | Checks open todos, missing markers, uncommitted changes |

### Session-Init Hook

Marker files (`.claude/.*-done`, `.claude/.schema-analyzed`) are **gitignored** and session-scoped. The `session-init.sh` hook detects a new Claude Code session by comparing the parent process PID + start time against a stored `.claude/.session-id` file:

- **Same session** → exits immediately, nothing deleted
- **New session** → deletes all markers from `completeness.markers` and `schema.markerFile` in pipeline.json, writes new `.session-id`

This prevents stale markers from a previous session from falsely satisfying the completeness check.

### Prerequisites

- `jq` must be installed for hooks to read pipeline.json
- Hooks degrade gracefully (no warnings) if jq is missing

---

## Customization

### Disabling Agents

Set `enabled: false` in `pipeline.agents`:

```json
"schema-analyzer": { "model": "opus", "stage": "ANALYZE", "enabled": false }
```

### Changing Models

Adjust `model` per agent:

```json
"codebase-scout": { "model": "sonnet", "stage": "ANALYZE", "enabled": true }
```

### Adding Compliance Rules

Add rules to `pipeline.compliance.rules`:

```json
{
  "pattern": "console\\.log",
  "message": "Remove console.log before committing.",
  "severity": "warning"
}
```

### Adding Quality Gates

Add gates to `pipeline.quality.gates`:

```json
{ "name": "e2e", "command": "npm run test:e2e" }
```

### Custom Layers

Modify `pipeline.layers` for your project's architecture:

```json
"layers": ["Models", "Services", "Controllers", "Views", "Routes"]
```

---

## Dual Todo Tracking

The framework uses two complementary tracking mechanisms:

1. **`tasks/todo.md`** (file) — Persistent across sessions. The PLAN stage writes checkboxed items here. Serves as a historical record.
2. **TodoWrite tool** (built-in) — Real-time progress UI during the current session. Updated during EXECUTE as tasks complete.

Both are populated during PLAN and kept in sync during EXECUTE.

---

## Session Onboarding

When `onboarding.enabled` is true, each new session starts with a brief status message:

- Open task count from todo.md
- Pipeline overview (classify -> analyze -> plan with approval -> implement)
- Available slash commands

# Project Brief: 1gegen1 Liga-App

Vereinsinterne Liga-Verwaltungs-App fuer 1-gegen-1 Schuetzenwettkaempfe.

---

## Core Rules (non-negotiable)

1. **Server Actions** instead of API Routes for form actions
2. **No `any`** -- TypeScript strict mode
3. **No userId filter** on club-wide data -- auth via role (ADMIN/USER)
4. **Archive instead of delete** for data with dependencies (exception: Admin force-delete)
5. **shadcn/ui** for all UI elements -- no native browser dialogs

## Feature Implementation Order

Schema -> Migration -> Types -> Queries -> Actions -> Calculate -> Components -> Page -> Prettier -> `/check` -> Docs

## Domain Language

| Context                           | Language |
| --------------------------------- | -------- |
| UI text, error messages, comments | German   |
| Components, functions, file names | English  |
| Routes / URL segments             | English  |
| Commit messages                   | English  |
| Documentation                     | German   |

---

## How to Formulate Requests

### NEW_PLANNED -- Known feature

Reference `.claude/docs/features.md` or `.claude/tasks/todo.md`:

```
"Implement the Meyton import feature as described in features.md."
"Build the referee role from the SRS."
"Next feature from todo.md."
```

### NEW_UNKNOWN -- New requirement

Clearly mark as new:

```
"I'd like a statistics page for participants."
"Can we add a CSV export for results?"
"New idea: notifications when results are entered."
```

### MODIFICATION -- Change existing feature

Name the existing feature + desired change:

```
"Change playoff qualification from top 4/8 to top 6."
"Table sorting should prioritize Ringteiler over points."
"Add an optional description field to league editing."
```

### BUGFIX -- Report an error

Error description, ideally with context:

```
"Standings calculation shows wrong points for bye matches."
"On mobile, playoff cards are cut off."
"Error: page crashes when a participant withdraws."
```

Also accepted: screenshots, error messages, stack traces.

### MAINTENANCE -- Cleanup

Clearly formulate as maintenance task:

```
"Update the README with the new feature."
"Refactor calculateStandings -- the function is too long."
"Clean up unused imports in src/lib/."
```

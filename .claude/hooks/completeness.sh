#!/bin/bash
# Stop Hook: Completeness Check (non-blocking)
# Reminds about open tasks, missing quality markers, and finalize steps.
# Reads config from .claude/pipeline.json.
# Exit 0 = allow (warnings in stdout).

PIPELINE=".claude/pipeline.json"
WARNINGS=""

# Read config from pipeline.json (with fallbacks)
if [ -f "$PIPELINE" ] && command -v jq &>/dev/null; then
  TODO_FILE=$(jq -r '.completeness.todoFile // "tasks/todo.md"' "$PIPELINE" 2>/dev/null)
  EXTENSIONS=$(jq -r '.completeness.trackedExtensions // [".ts", ".tsx"] | join("|")' "$PIPELINE" 2>/dev/null)
  MARKERS=$(jq -r '.completeness.markers // [] | .[]' "$PIPELINE" 2>/dev/null)
else
  TODO_FILE="tasks/todo.md"
  EXTENSIONS=".ts|.tsx"
  MARKERS=""
fi

# 1. Open items in todo file
if [ -f "$TODO_FILE" ]; then
  UNCHECKED=$(grep -c '^\s*- \[ \]' "$TODO_FILE" 2>/dev/null)
  UNCHECKED=${UNCHECKED:-0}
  if [ "$UNCHECKED" -gt 0 ]; then
    WARNINGS="${WARNINGS}
- ${TODO_FILE} has ${UNCHECKED} open items."
  fi
fi

# 2. Uncommitted code changes
CHANGED=$(git diff --name-only HEAD 2>/dev/null | grep -cE "(${EXTENSIONS})$" || true)
CHANGED=${CHANGED:-0}
STAGED=$(git diff --cached --name-only 2>/dev/null | grep -cE "(${EXTENSIONS})$" || true)
STAGED=${STAGED:-0}
TOTAL_CHANGED=$((CHANGED + STAGED))

if [ "$TOTAL_CHANGED" -gt 0 ]; then
  # 3. Check for missing completeness markers
  MISSING_MARKERS=""
  if [ -n "$MARKERS" ]; then
    while IFS= read -r marker; do
      if [ ! -f "$marker" ]; then
        MARKER_NAME=$(basename "$marker" | sed 's/^\.//' | sed 's/-done$//')
        MISSING_MARKERS="${MISSING_MARKERS}
    [ ] ${MARKER_NAME} not run"
      fi
    done <<< "$MARKERS"
  fi

  WARNINGS="${WARNINGS}
- ${TOTAL_CHANGED} changed code files detected. EXECUTE phase complete?
    [ ] /check run (all quality gates)?${MISSING_MARKERS}
    [ ] /commit-msg for commit message?"
fi

if [ -n "$WARNINGS" ]; then
  echo "Completeness Check:${WARNINGS}"
fi

exit 0

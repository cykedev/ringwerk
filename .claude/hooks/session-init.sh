#!/bin/bash
# UserPromptSubmit Hook: Clean completeness markers at the start of a new Claude Code session.
#
# Session detection: the parent PID ($PPID) is the Claude Code process.
# Combined with its start time, this forms a unique session key that changes
# when Claude Code restarts but stays stable within a session.
#
# Exit 0 = always allow (non-blocking).

PIPELINE=".claude/pipeline.json"
SESSION_FILE=".claude/.session-id"

# Build session key from parent PID + start time (unique per Claude Code invocation)
PARENT_PID=$PPID
PARENT_START=$(ps -o lstart= -p "$PARENT_PID" 2>/dev/null | xargs)
SESSION_KEY="${PARENT_PID}-${PARENT_START}"

# Still in the same session? Nothing to do.
if [ -f "$SESSION_FILE" ]; then
  STORED_KEY=$(cat "$SESSION_FILE" 2>/dev/null)
  if [ "$STORED_KEY" = "$SESSION_KEY" ]; then
    exit 0
  fi
fi

# New session detected — clean all completeness markers
if [ -f "$PIPELINE" ] && command -v jq &>/dev/null; then
  while IFS= read -r marker; do
    [ -n "$marker" ] && rm -f "$marker"
  done < <(jq -r '.completeness.markers // [] | .[]' "$PIPELINE" 2>/dev/null)

  SCHEMA_MARKER=$(jq -r '.schema.markerFile // ""' "$PIPELINE" 2>/dev/null)
  [ -n "$SCHEMA_MARKER" ] && rm -f "$SCHEMA_MARKER"
else
  # Fallback if jq unavailable
  rm -f .claude/.*-done .claude/.schema-analyzed
fi

# Persist session key
echo "$SESSION_KEY" > "$SESSION_FILE"

exit 0

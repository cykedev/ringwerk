#!/bin/bash
# PreToolUse Hook: Schema Gate (non-blocking)
# Warns if schema migration is run without prior schema analysis.
# Reads config from .claude/pipeline.json.
# Exit 0 = allow (warnings in stdout).

PIPELINE=".claude/pipeline.json"
INPUT=$(cat)

# Read migrate command pattern from pipeline.json
if [ -f "$PIPELINE" ] && command -v jq &>/dev/null; then
  MIGRATE_CMD=$(jq -r '.schema.migrateCommand // "prisma migrate"' "$PIPELINE" 2>/dev/null)
  MARKER_FILE=$(jq -r '.schema.markerFile // ".claude/.schema-analyzed"' "$PIPELINE" 2>/dev/null)
else
  MIGRATE_CMD="prisma migrate"
  MARKER_FILE=".claude/.schema-analyzed"
fi

# Only trigger on migration commands
if ! echo "$INPUT" | grep -q "$MIGRATE_CMD"; then
  exit 0
fi

if [ ! -f "$MARKER_FILE" ]; then
  echo "Schema Gate Warning: The schema-analyzer agent has not been run yet. Run the schema-analyzer agent first to check for migration risks."
fi

exit 0

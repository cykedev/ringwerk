#!/bin/bash
# PreToolUse Hook: Code Compliance Check (non-blocking)
# Reads compliance rules from .claude/pipeline.json and checks tool input.
# Exit 0 = allow (warnings in stdout).

PIPELINE=".claude/pipeline.json"
INPUT=$(cat)

# Check if pipeline.json exists
if [ ! -f "$PIPELINE" ]; then
  exit 0
fi

# Check if jq is available
if ! command -v jq &>/dev/null; then
  exit 0
fi

# Read file pattern from pipeline.json
FILE_PATTERN=$(jq -r '.compliance.filePattern // ""' "$PIPELINE" 2>/dev/null)
if [ -z "$FILE_PATTERN" ]; then
  exit 0
fi

# Only check files matching the configured pattern
if ! echo "$INPUT" | grep -qE "$FILE_PATTERN"; then
  exit 0
fi

WARNINGS=""

# Read and check each compliance rule from pipeline.json
RULE_COUNT=$(jq '.compliance.rules | length' "$PIPELINE" 2>/dev/null)
if [ -z "$RULE_COUNT" ] || [ "$RULE_COUNT" -eq 0 ]; then
  exit 0
fi

for i in $(seq 0 $((RULE_COUNT - 1))); do
  PATTERN=$(jq -r ".compliance.rules[$i].pattern // \"\"" "$PIPELINE" 2>/dev/null)
  ANTI_PATTERN=$(jq -r ".compliance.rules[$i].antiPattern // \"\"" "$PIPELINE" 2>/dev/null)
  MESSAGE=$(jq -r ".compliance.rules[$i].message // \"\"" "$PIPELINE" 2>/dev/null)

  if [ -z "$PATTERN" ] || [ -z "$MESSAGE" ]; then
    continue
  fi

  if echo "$INPUT" | grep -qE "$PATTERN"; then
    # If there's an anti-pattern, only warn when anti-pattern is NOT present
    if [ -n "$ANTI_PATTERN" ] && [ "$ANTI_PATTERN" != "null" ]; then
      if ! echo "$INPUT" | grep -q "$ANTI_PATTERN"; then
        WARNINGS="${WARNINGS}
- ${MESSAGE}"
      fi
    else
      WARNINGS="${WARNINGS}
- ${MESSAGE}"
    fi
  fi
done

if [ -n "$WARNINGS" ]; then
  echo "Code Compliance Warning:${WARNINGS}"
fi

exit 0

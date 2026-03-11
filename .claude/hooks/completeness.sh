#!/bin/bash
# Stop Hook: Vollstaendigkeits-Check (nicht-blockierend)
# Erinnert an offene Tasks, fehlende Qualitaetschecks und Abschluss-Schritte.
# Exit 0 = erlauben (Warnungen in stdout).

WARNINGS=""

# 1. Offene Items in todo.md
if [ -f "tasks/todo.md" ]; then
  UNCHECKED=$(grep -c '^\s*- \[ \]' tasks/todo.md 2>/dev/null || echo 0)
  if [ "$UNCHECKED" -gt 0 ]; then
    WARNINGS="${WARNINGS}
- tasks/todo.md hat noch ${UNCHECKED} offene Items."
  fi
fi

# 2. Uncommittete Code-Aenderungen → /check + Abschluss vergessen?
CHANGED_TS=$(git diff --name-only HEAD 2>/dev/null | grep -cE '\.(ts|tsx)$' || echo 0)
STAGED_TS=$(git diff --cached --name-only 2>/dev/null | grep -cE '\.(ts|tsx)$' || echo 0)
TOTAL_CHANGED=$((CHANGED_TS + STAGED_TS))

if [ "$TOTAL_CHANGED" -gt 0 ]; then
  WARNINGS="${WARNINGS}
- ${TOTAL_CHANGED} geaenderte .ts/.tsx Dateien. EXECUTE-Phase komplett? Checkliste:
    [ ] /check ausgefuehrt (Lint, Format, Test, TSC)?
    [ ] action-audit auf geaenderte Actions?
    [ ] docs-sync (README, features.md)?
    [ ] lessons-check (neue Erkenntnisse)?
    [ ] /commit-msg fuer Commit-Message?"
fi

if [ -n "$WARNINGS" ]; then
  echo "Vollstaendigkeits-Check:${WARNINGS}"
fi

exit 0

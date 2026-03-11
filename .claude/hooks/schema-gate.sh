#!/bin/bash
# PreToolUse Hook: Schema-Gate (nicht-blockierend)
# Warnt wenn 'prisma migrate' ohne vorherige Schema-Analyse ausgefuehrt wird.
# Exit 0 = erlauben (Warnungen in stdout).

INPUT=$(cat)

# Nur bei prisma migrate Befehlen
if ! echo "$INPUT" | grep -q 'prisma migrate'; then
  exit 0
fi

if [ ! -f ".claude/.schema-analyzed" ]; then
  echo "Schema-Gate-Warnung: Der schema-analyzer Agent wurde noch nicht ausgefuehrt. Empfehlung: Zuerst den schema-analyzer Agenten starten, um Migrations-Risiken zu pruefen."
fi

exit 0

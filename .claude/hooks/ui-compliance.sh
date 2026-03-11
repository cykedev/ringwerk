#!/bin/bash
# PreToolUse Hook: UI-Compliance-Check (nicht-blockierend)
# Prüft .tsx-Dateien auf häufige UI-Pattern-Verstösse.
# Exit 0 = erlauben (Warnungen in stdout).

INPUT=$(cat)

# Nur .tsx-Dateien prüfen
if ! echo "$INPUT" | grep -q '\.tsx"'; then
  exit 0
fi

WARNINGS=""

# --- Native Browser-Dialoge ---
if echo "$INPUT" | grep -qE '(window\.)?(confirm|alert|prompt)\s*\('; then
  WARNINGS="${WARNINGS}
- Native Browser-Dialog erkannt (confirm/alert/prompt). Verwende AlertDialog aus shadcn/ui."
fi

# --- DropdownMenu in Listenzeilen ---
if echo "$INPUT" | grep -q 'DropdownMenu'; then
  WARNINGS="${WARNINGS}
- DropdownMenu erkannt. In Listenzeilen Inline-Icon-Buttons verwenden (variant=\"ghost\" size=\"icon\" className=\"h-10 w-10\"). Ausnahme: Ligen-Karten mit vielen Status-Optionen."
fi

# --- Fehlende bg-card auf Containern ---
if echo "$INPUT" | grep -q 'rounded-lg border"'; then
  if ! echo "$INPUT" | grep -q 'rounded-lg border bg-card'; then
    WARNINGS="${WARNINGS}
- Container mit 'rounded-lg border' ohne 'bg-card' erkannt. Pflicht: 'rounded-lg border bg-card' fuer Dark-Mode-Kompatibilitaet."
  fi
fi

# --- Touch-Targets zu klein ---
if echo "$INPUT" | grep -qE 'size="icon".*className="h-8 w-8"'; then
  WARNINGS="${WARNINGS}
- Icon-Button mit h-8 w-8 erkannt. Minimum fuer Touch-Targets: h-10 w-10 (40px)."
fi

# --- toLocaleDateString ohne Timezone ---
if echo "$INPUT" | grep -q 'toLocaleDateString()'; then
  WARNINGS="${WARNINGS}
- toLocaleDateString() ohne Timezone erkannt. Verwende formatDateOnly(date, tz) aus @/lib/dateTime."
fi

if [ -n "$WARNINGS" ]; then
  echo "UI-Compliance-Warnung:${WARNINGS}"
fi

exit 0

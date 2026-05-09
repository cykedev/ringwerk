# Lernlog – Liga-App

Wird nach jeder Nutzerkorrektur aktualisiert.
Format: Datum | Fehler | Regel die ihn verhindert

---

<!-- Zuletzt konsolidiert: 2026-05-07 -->

| 2026-05-09 | React 19 setzt `<form action={fn}>` mit uncontrolled Inputs (`defaultValue`) nach jedem Submit zurück — auch bei Validation Errors verlieren User ihre Eingaben | Forms mit `useActionState`: Inputs IMMER controlled (`value` + `onChange` + lokaler State) — nie `defaultValue` bei Server-Action-Forms |
| 2026-05-09 | Prettier schlägt für `.claude/` Markdown-Dateien an — auch Plan/Spec-Files müssen mit `npx prettier --write` formatiert werden bevor committing | Nach Erstellen von Spec/Plan-Files immer `npx prettier --write` laufen lassen |
| 2026-05-08 | `getEffectiveScoringType` ignorierte `targetValueType` — TARGET*\*-Kranzl mit Zielwert-Typ "Ringe (Zehntel)" zwang Ganzzahl-Eingabe | Bei `scoringMode = TARGET*\*`muss`targetValueType`Vorrang vor der Disziplin haben; alle Effective-Scoring-Aufrufe brauchen scoringMode + discipline + targetValueType |
| 2026-04-04 |`competition.discipline`-Check brach gemischte Wettbewerbe ab — Fix: per-CP-Lookup als Fallback | Bei gemischten Wettbewerben nie `competition.discipline`als einzige Quelle — immer`competitionParticipant.discipline`als Fallback |
| 2026-03-26 |`rankByScore`nutzte`participantId`als Key — Doppel-Enrollment verlor Einträge | Bei Team-Events`seriesId` als Identity-Key verwenden |

## Abgeschlossen

# Lernlog – Liga-App

Wird nach jeder Nutzerkorrektur aktualisiert.
Format: Datum | Fehler | Regel die ihn verhindert

---

<!-- Zuletzt konsolidiert: 2026-04-04 -->

| 2026-04-04 | `results/actions.ts` und `playoffs/actions/duel.ts` hatten `if (!competition.discipline) return error` — brach für gemischte Wettbewerbe komplett ab. Fix: per-CP-Lookup, wenn `competition.discipline === null`. Gleicher Fehler war in Schedule/Playoffs-PDF-Routes. | Bei gemischten Wettbewerben nie `competition.discipline` als einzige Quelle nutzen — immer per-Teilnehmer (`competitionParticipant.discipline`) als Fallback implementieren. |
| 2026-03-26 | `rankByScore` nutzte `participantId` als Identity-Key — Doppel-Enrollment führte zu nur einem Eintrag in der Rangliste. | Bei Team-Events den `seriesId` als Identity-Key verwenden. |

## Abgeschlossen

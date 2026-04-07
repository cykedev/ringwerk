# Lernlog – Liga-App

Wird nach jeder Nutzerkorrektur aktualisiert.
Format: Datum | Fehler | Regel die ihn verhindert

---

<!-- Zuletzt konsolidiert: 2026-04-06 -->

| 2026-04-04 | `competition.discipline`-Check brach gemischte Wettbewerbe ab — Fix: per-CP-Lookup als Fallback | Bei gemischten Wettbewerben nie `competition.discipline` als einzige Quelle — immer `competitionParticipant.discipline` als Fallback |
| 2026-03-26 | `rankByScore` nutzte `participantId` als Key — Doppel-Enrollment verlor Einträge | Bei Team-Events `seriesId` als Identity-Key verwenden |

## Abgeschlossen

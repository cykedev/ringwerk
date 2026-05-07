# Lernlog – Liga-App

Wird nach jeder Nutzerkorrektur aktualisiert.
Format: Datum | Fehler | Regel die ihn verhindert

---

<!-- Zuletzt konsolidiert: 2026-05-07 -->

| 2026-05-07 | `borderRightWidth` auf `<Text>` und Flex-Stretch-Separator-Views in react-pdf ergaben keine durchgehenden Spaltenlinien — Fix: explizite `height` auf `<View>`-Zellen mit `borderRightWidth` | In react-pdf für Spaltentrennlinien nie auf Flex-Stretch vertrauen — stattdessen explizite Höhe auf Zell-Views setzen |
| 2026-05-07 | PDF-Route hatte nur Session-Check, nicht `canManage()` — Reviewer entdeckte PII-Exposur | Neue PDF-Routes für sensitive Daten immer mit demselben Role-Check wie die zugehörige Page absichern |
| 2026-04-04 | `competition.discipline`-Check brach gemischte Wettbewerbe ab — Fix: per-CP-Lookup als Fallback | Bei gemischten Wettbewerben nie `competition.discipline` als einzige Quelle — immer `competitionParticipant.discipline` als Fallback |
| 2026-03-26 | `rankByScore` nutzte `participantId` als Key — Doppel-Enrollment verlor Einträge | Bei Team-Events `seriesId` als Identity-Key verwenden |

## Abgeschlossen

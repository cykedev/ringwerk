# Lernlog – Liga-App

Wird nach jeder Nutzerkorrektur aktualisiert.
Format: Datum | Fehler | Regel die ihn verhindert

---

<!-- Zuletzt konsolidiert: 2026-04-04 -->

| 2026-04-06 | ESLint 10 ist inkompatibel mit `eslint-config-next` 16.2.2 — das gebündelte `eslint-plugin-react` 7.37.5 nutzt die in ESLint 10 entfernte `getFilename()`-API. Upgrade auf ESLint 10 schlägt fehl solange eslint-config-next kein kompatibles eslint-plugin-react mitbringt. | ESLint-Upgrades immer zusammen mit eslint-config-next prüfen — beide müssen kompatibel sein. |
| 2026-04-06 | `recharts` war als Dependency eingetragen, aber `chart.tsx` wurde nie importiert. `npm outdated` hat das nicht angezeigt — erst durch gezielten grep-Check wurde das erkannt. | Vor Dependency-Upgrades prüfen ob die Dependency überhaupt genutzt wird (`grep -r "from.*chart" src/`). |
| 2026-04-06 | `npm update` ändert `package.json` nicht — nur `package-lock.json`. Ein automatischer Spec-Reviewer hat das als Fehler gemeldet, weil er `^x.y.z` in package.json erwartete. | `npm update` ist korrekt — es aktualisiert nur das Lock-File innerhalb der bestehenden semver-Ranges. package.json bleibt unverändert. |
| 2026-04-04 | `results/actions.ts` und `playoffs/actions/duel.ts` hatten `if (!competition.discipline) return error` — brach für gemischte Wettbewerbe komplett ab. Fix: per-CP-Lookup, wenn `competition.discipline === null`. Gleicher Fehler war in Schedule/Playoffs-PDF-Routes. | Bei gemischten Wettbewerben nie `competition.discipline` als einzige Quelle nutzen — immer per-Teilnehmer (`competitionParticipant.discipline`) als Fallback implementieren. |
| 2026-03-26 | `rankByScore` nutzte `participantId` als Identity-Key — Doppel-Enrollment führte zu nur einem Eintrag in der Rangliste. | Bei Team-Events den `seriesId` als Identity-Key verwenden. |

## Abgeschlossen

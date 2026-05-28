# Lernlog – Liga-App

Wird nach jeder Nutzerkorrektur aktualisiert.
Format: Datum | Fehler | Regel die ihn verhindert

---

<!-- Zuletzt konsolidiert: 2026-05-28 -->

| 2026-05-28 | `unstable_cache` serialisiert Return-Values via JSON (nicht structured clone). Ein `Buffer` round-trippt als `{ type: "Buffer", data: [...] }` und `new Uint8Array(...)` produziert daraus ein leeres Array → leeres PDF beim 2. Request (1. Request war Cache-Miss, kam direkt aus dem Promise) | In `unstable_cache` nur JSON-serialisierbare Werte zurückgeben. Binärdaten (Buffer, Uint8Array) als Base64-String cachen und beim Lesen wieder decoden |
| 2026-05-28 | Turbopack-Production-Build brach mit "Module not found: dns/fs/net/tls" weil eine Client Component (`CompetitionForm.tsx`) `slugify`/`SLUG_REGEX` aus `publicSlug.ts` importierte — dieselbe Datei exportierte auch DB-Funktionen mit `db`/`pg`-Import. Tree-Shaking griff nicht, der ganze Bundle zog `pg` in den Client | Pure client-safe Helpers und DB-Funktionen NIE in derselben Datei exportieren. Splitten in `<feature>.ts` (pure) + `<feature>Queries.ts` (DB). Lint-Gates fangen das nicht — nur der echte `next build` |
| 2026-05-28 | Tag-basiertes `revalidateTag` für ein öffentliches PDF wurde nur in den Competitions-Actions ausgelöst, nicht bei Result-/Series-/Playoff-Eintragungen. Folge: bis zu 24 h veraltete Daten auf der Vereinswebsite | Bei tag-basiertem Caching: in **allen** schreibenden Actions invalidieren, nicht nur dort wo der Tag "logisch zuhause" ist. Zentraler Helper (`revalidatePublicSlugForCompetition`), der `competition.findUnique({ select: { isPublic, publicSlug }})` läuft, hält die Streuung lesbar |
| 2026-05-08 | `getEffectiveScoringType` ignorierte `targetValueType` — TARGET\*-Kranzl mit Zielwert-Typ "Ringe (Zehntel)" zwang Ganzzahl-Eingabe | Bei `scoringMode = TARGET*` muss `targetValueType` Vorrang vor der Disziplin haben; alle Effective-Scoring-Aufrufe brauchen scoringMode + discipline + targetValueType |
| 2026-04-04 | `competition.discipline`-Check brach gemischte Wettbewerbe ab — Fix: per-CP-Lookup als Fallback | Bei gemischten Wettbewerben nie `competition.discipline` als einzige Quelle — immer `competitionParticipant.discipline` als Fallback |
| 2026-03-26 | `rankByScore` nutzte `participantId` als Key — Doppel-Enrollment verlor Einträge | Bei Team-Events `seriesId` als Identity-Key verwenden |

## Abgeschlossen

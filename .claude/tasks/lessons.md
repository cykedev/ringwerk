# Lernlog – Liga-App

Wird nach jeder Nutzerkorrektur aktualisiert.
Format: Datum | Fehler | Regel die ihn verhindert

---

<!-- Zuletzt konsolidiert: 2026-04-03 -->

| 2026-04-03 | `EventSeriesItem.discipline` hatte kein `scoringType`-Feld — der Ranking-Code griff deshalb auf `config.discipline?.scoringType ?? "WHOLE"` zurück, was in gemischten Events (config.discipline = null) immer WHOLE = 100 lieferte, auch für DECIMAL-Disziplinen (max 109). Falsche Plätze in der Rangliste als Folge. | Wenn eine Entity pro Teilnehmer unterschiedliche Wertungsart haben kann, muss der Typ auch `scoringType` tragen — nicht auf Competition-Level-Fallback verlassen. |
| 2026-04-03 | Bestehende Seriendaten waren mit maxRings=100 gespeichert (Kranzl 2026: LPA-Teilnehmer RT=6.0 statt 15.0), obwohl der aktuelle Save-Code korrekt `discipline.scoringType` nutzt. Hinweis: Datenfehler aus alter Code-Version kann neben Code-Bug gleichzeitig existieren. | Bei Bugs im Speicherformat immer prüfen: Ist der aktuelle Code korrekt, aber historische Daten sind veraltet? → Datenmigration zusätzlich zum Code-Fix. |
| 2026-04-02 | Page-Level-Guards (`role !== "ADMIN"`) in ~10 Pages wurden beim Planen vergessen — nur Actions und Navigation waren im Scope. MANAGER konnte Nav-Links sehen, bekam aber beim Klick einen Redirect. | Beim Implementieren einer neuen Rolle: Actions + Navigation sind nicht genug. Explizit alle Page-Dateien auf direkte Role-Checks durchsuchen (`grep role !== "ADMIN"` in `src/app/`) und in den Plan aufnehmen. |
| 2026-03-29 | Subagent vergass JSDoc-Kommentar bei neuer Lib-Funktion `formatParticipantName` — erst Code-Quality-Review hat es entdeckt | Subagent-Prompts für neue `lib/`-Funktionen explizit auf JSDoc-Pflicht hinweisen (steht in code-conventions.md, wird aber übersehen). Alternativ: Reviewer-Checklist um "JSDoc bei lib-Funktionen" erweitern |
| 2026-03-26 | Neuer ScoringMode `TARGET_OVER` zum Prisma Enum hinzugefügt, aber Zod Validation Schema in `actions.ts` nicht aktualisiert — Form-Submit schlägt fehl mit "Ungültiger Wertungsmodus" | Bei neuen ScoringMode-Werten: das Zod Enum in `src/lib/competitions/actions.ts` (BaseSchema.scoringMode, Zeile ~28) ist eine manuelle Liste, nicht vom Prisma Schema abgeleitet — muss parallel aktualisiert werden. |
| 2026-03-26 | `rankByScore` nutzte `participantId` als Identity-Key — Doppel-Enrollment (zwei CPs für denselben Teilnehmer) führte dazu, dass nur ein Eintrag in der Rangliste erschien | Bei Team-Events den `seriesId` als Identity-Key verwenden, nicht `participantId` — jede Serie ist eindeutig, auch wenn Teilnehmer mehrfach eingeschrieben sind |
| 2026-03-26 | getEventWithSeries und getSeasonWithSeries filterten WITHDRAWN-Teilnehmer nicht — deren Serien/Einschreibungen wurden trotzdem in Ranglisten angezeigt | Bei Series/Participant-Queries für Ranglisten immer status: "ACTIVE" filtern — WITHDRAWN-Teilnehmer haben ihren CP-Status gesetzt, aber ihre Daten bleiben in der DB |

## Abgeschlossen

# Datenmodell & Glossar – Ringwerk

---

## Kernentitaeten (Zielzustand)

### Benutzer (User)

- E-Mail, Passwort (bcrypt), Rolle (ADMIN | MANAGER | USER), Status
- Vereinsweite Daten — kein userId-Filter auf Fachdaten
- MANAGER: kann Wettbewerbe, Ergebnisse, Teilnehmer und Disziplinen verwalten; kein Zugriff auf Nutzerverwaltung (/admin/) und Force-Delete

**Hinweis:** Das "W" in Wettbewerb wird immer groß geschrieben.

### Disziplin (Discipline)

- Name, Kuerzel, Wertungsart (WHOLE | DECIMAL), Max.Ringe/Schuss
- **teilerFaktor: Decimal (default 1.0)** — Korrekturfaktor fuer gemischte Wertungen
- Status: aktiv | archiviert
- Systemdisziplinen: LP (0.333), LG (1.0), LPA (0.6), LGA (1.8)

### Wettbewerb (Competition) — ersetzt League

- **type: CompetitionType** (LEAGUE | EVENT | SEASON) — bestimmt Verhalten und UI
- Name, Status (DRAFT | ACTIVE | COMPLETED | ARCHIVED)
- **scoringMode: ScoringMode** — primärer Wertungsmodus (bei Liga: Gruppenphase)
- **shotsPerSeries: Int (default 10)** — Schusszahl pro Serie
- **disciplineId: String?** — null = gemischte Disziplinen (Faktor-Korrektur aktiv)
- Typ-spezifische Felder (nullable, nur relevant für jeweiligen Typ):
- **liga, event, saison: String?** — externe Referenzen zur Registrierung (optional, für Audit)

#### Liga-spezifisch (LEAGUE)

| Feld                    | Typ          | Default    | Beschreibung                                                         |
| ----------------------- | ------------ | ---------- | -------------------------------------------------------------------- |
| roundDeadlineHin        | DateTime?    | null       | Stichtag Hinrunde                                                    |
| roundDeadlineRueck      | DateTime?    | null       | Stichtag Rückrunde                                                   |
| groupScoringMode        | ScoringMode? | RINGTEILER | Wertungsmodus Gruppenphase (= scoringMode)                           |
| playoffBestOf           | Int?         | 3          | Siege zum Weiterkommen VF/HF (3 = Best-of-Five)                      |
| playoffHasViertelfinale | Boolean      | true       | Viertelfinale aktiv (Top 8, 4 Paarungen)                             |
| playoffHasAchtelfinale  | Boolean      | false      | Achtelfinale aktiv (Top 16, 8 Paarungen); überschreibt VF-Flag       |
| playoffQualThreshold    | Int?         | 8          | Ab dieser TN-Zahl → Viertelfinale                                    |
| playoffQualTopN1        | Int?         | 4          | Qualifikanten für HF bei Direkteinstieg                              |
| playoffQualTopN2        | Int?         | 8          | Qualifikanten für VF                                                 |
| finalePrimary           | ScoringMode  | RINGS      | Hauptkriterium Finale (Pflicht); Default: nur Ringe, höchste gewinnt |
| finaleTiebreaker1       | ScoringMode? | null       | Tiebreaker-Kriterium 1 bei Gleichstand (optional)                    |
| finaleTiebreaker2       | ScoringMode? | null       | Tiebreaker-Kriterium 2 bei weiterem Gleichstand (optional)           |
| finaleHasSuddenDeath    | Boolean?     | true       | Sudden Death nach allen Kriterien noch Gleichstand                   |

#### Event-spezifisch (EVENT)

| Feld            | Typ              | Default | Beschreibung                                  |
| --------------- | ---------------- | ------- | --------------------------------------------- |
| eventDate       | DateTime?        | null    | Veranstaltungsdatum                           |
| allowGuests     | Boolean?         | false   | Gastteilnehmer erlaubt                        |
| teamSize        | Int?             | null    | null = Einzel; 2+ = Teamgroesse               |
| targetValue     | Decimal?         | null    | Zielwert (nur TARGET_ABSOLUTE / TARGET_UNDER) |
| targetValueType | TargetValueType? | null    | TEILER, RINGS oder RINGS_DECIMAL              |

#### Saison-spezifisch (SEASON)

| Feld        | Typ       | Default | Beschreibung                      |
| ----------- | --------- | ------- | --------------------------------- |
| minSeries   | Int?      | 20      | Mindestanzahl Serien fuer Wertung |
| seasonStart | DateTime? | null    | Saisonbeginn                      |
| seasonEnd   | DateTime? | null    | Saisonende                        |

### Wettbewerbs-Teilnehmer (CompetitionParticipant) — ersetzt LeagueParticipant

- competitionId, participantId
- **disciplineId: String?** — individuelle Disziplinwahl bei gemischten Wettbewerben; null bei disziplin-gebundenen
- startNumber: Int?
- status: ACTIVE | WITHDRAWN
- **isGuest: Boolean (default false)** — Gastteilnehmer bei Events; wird in der Event-Rangliste als "Gast"-Badge angezeigt
- withdrawalReason, withdrawnAt, withdrawalDate

### Teilnehmer (Participant)

- Name, Vorname, Kontaktmoeglichkeit (E-Mail oder Telefon, optional)
- Status: aktiv | inaktiv
- Kann in mehreren Wettbewerben eingeschrieben sein
- **isGuestRecord: Boolean (default false)** — Markiert stille Gast-Datensätze; nicht sichtbar in der Teilnehmerverwaltung
- Gast-Datensätze werden automatisch gelöscht, wenn der Gast aus einem Event abgemeldet wird

### Serie (Series) — ersetzt MatchResult

Universelle Ergebniseinheit für alle Wettbewerbstypen:

- **competitionParticipantId: String (FK)** — Zuordnung zu Teilnehmer im Wettbewerb
- **disciplineId: String (FK)** — geschossene Disziplin (wichtig bei gemischten Wettbewerben)
- **rings: Decimal** — Gesamtringe der Serie
- **teiler: Decimal** — bester Teiler der Serie
- **shots: Decimal[]?** — Einzelschusswerte (Pflicht bei DECIMAL_REST-Modus in LEAGUE; optional sonst)
- **shotCount: Int** — Anzahl Schüsse (default aus Competition.shotsPerSeries)
- **sessionDate: DateTime** — Schießdatum (relevant für Saison-Modus)
- **matchupId: String? (FK)** — nur bei Liga: Verknüpfung zur Paarung
- **isGuest: Boolean (default false)** — Hilfsflag für Event-Rangliste (denormalisiert aus CompetitionParticipant.isGuest)

### Paarung (Matchup) — nur Liga

- competitionId, roundIndex, homeId, awayId, status
- Unveraendert gegenueber bisherigem Modell (nur FK-Referenz Competition statt League)

### Playoff-Strukturen — nur Liga

- PlayoffMatch, PlayoffDuel, PlayoffDuelResult
- Unveraendert gegenueber bisherigem Modell (nur FK-Referenz Competition statt League)

### Audit-Log

- Wie bisher, aber `leagueId` wird zu `competitionId`
- Neue Ereignistypen für Event und Saison nach Bedarf
- `AuditLog.competitionId` ist die zentrale FK zur Competition

---

## Enums (Zielzustand)

### CompetitionType (NEU)

```
LEAGUE    – Liga mit Spielplan, Tabelle, Playoffs
EVENT     – Einmaliges Event (Kranzlschiessen)
SEASON    – Langzeit-Wettbewerb (Jahrespreisschiessen)
```

### ScoringMode (NEU)

```
RINGTEILER       – MaxRinge - Ringe + (Teiler * Faktor); niedrigster gewinnt
RINGS            – Gesamtringe (ganzzahlig); hoechster gewinnt
RINGS_DECIMAL    – Gesamtringe (Zehntelwertung); hoechster gewinnt
TEILER           – Teiler * Faktor; niedrigster gewinnt
DECIMAL_REST     – Nachkommastelle der Ringe summiert; hoechster gewinnt
TARGET_ABSOLUTE  – Abweichung vom Zielwert; geringste gewinnt (nur EVENT)
TARGET_UNDER     – ≤ Zielwert bevorzugt, dann Abweichung; geringste gewinnt (nur EVENT)
```

### TargetValueType (NEU, nur bei TARGET-Modi)

```
TEILER          – Zielwert bezieht sich auf den (korrigierten) Teiler
RINGS           – Zielwert bezieht sich auf Gesamtringe (ganzzahlig)
RINGS_DECIMAL   – Zielwert bezieht sich auf Gesamtringe (Zehntelwertung)
```

### CompetitionStatus (ersetzt LeagueStatus)

```
DRAFT       – in Vorbereitung (noch nicht gestartet)
ACTIVE      – laufend
COMPLETED   – abgeschlossen
ARCHIVED    – archiviert
```

**Hinweis:** DRAFT ist das neue Status-Feld, das für alle Wettbewerbstypen beim Erstellen gesetzt wird.

### Bestehende Enums (unveraendert)

- ScoringType: WHOLE | DECIMAL (Disziplin-Wertungsart)
- ParticipantStatus: ACTIVE | WITHDRAWN
- MatchupStatus: PENDING | COMPLETED | BYE | WALKOVER
- PlayoffRound: EIGHTH_FINAL | QUARTER_FINAL | SEMI_FINAL | FINAL
- Role: ADMIN | MANAGER | USER
- ImportSource: MANUAL | URL | PDF

---

## Berechnungsregeln

### Faktor-Korrektur

```
korrigierterTeiler = Teiler * Disziplin.teilerFaktor
```

- LG freihand: Faktor 1.0 → Teiler unverändert
- LP freihand: Faktor 0.333 → Teiler / 3
- LG Auflage: Faktor 1.8 → Teiler \* 1.8
- LP Auflage: Faktor 0.6 → Teiler \* 0.6 (= 1.8 \* 0.333)
- Faktor ist frei konfigurierbar pro Disziplin

### Wertungsmodus: RINGTEILER

```
Ringteiler = MaxRinge − Ringe + (Teiler * Faktor)
```

- MaxRinge: 100 (WHOLE) | 109 (DECIMAL)
- Niedrigerer Ringteiler gewinnt
- Bei gemischten Disziplinen gleicht der Faktor die Teiler-Unterschiede aus

Beispiel (gemischt): LG-Schuetze: 96 Ringe, Teiler 3.7, Faktor 1.0 → RT = 100 - 96 + 3.7 = 7.7
LP-Schuetze: 88 Ringe, Teiler 18.0, Faktor 0.333 → RT = 100 - 88 + 6.0 = 18.0 ... Nein:
LP: RT = 100 - 88 + (18.0 \* 0.333) = 100 - 88 + 6.0 = 18.0

### Wertungsmodus: RINGS / RINGS_DECIMAL

```
Wert = Gesamtringe
```

- RINGS: ganzzahlig, max 100 (bei 10 Schuss)
- RINGS_DECIMAL: Zehntelwertung, max 109.0 (bei 10 Schuss)
- Höchster Wert gewinnt
- Kein Faktor beteiligt

### Wertungsmodus: TEILER

```
Wert = Teiler * Faktor
```

- Niedrigster Wert gewinnt
- Faktor-Korrektur aktiv bei gemischten Disziplinen

### Wertungsmodus: DECIMAL_REST

```
Wert = Summe der Nachkommastellen aller Ringe
```

- Beispiel: Bei Ringwerten 9.5, 10.2, 8.7 → 0.5 + 0.2 + 0.7 = 1.4
- Höchster Wert gewinnt
- Kein Faktor beteiligt
- Erfordert Einzelschusswerte (nicht nur Gesamtringe)
- **Nur in LEAGUE verfügbar** — EVENT und SEASON können DECIMAL_REST nicht verwenden (individuelle Schusswerte sind dort bei Event optional und bei Saison nicht dokumentiert)

### Wertungsmodus: TARGET_ABSOLUTE (nur EVENT)

```
Abweichung = |Messwert − Zielwert|
```

- Messwert = je nach targetValueType: Ringe, Teiler\*Faktor, oder Ringe (Zehntel)
- Geringste Abweichung gewinnt
- Bei Teiler-basiertem Zielwert: Faktor-Korrektur auf den Messwert, Zielwert ist im korrigierten Raum

### Wertungsmodus: TARGET_UNDER (nur EVENT)

```
Abweichung = Messwert − Zielwert
```

Ranking-Logik (zweistufig):

1. Alle Teilnehmer mit Messwert ≤ Zielwert, sortiert nach geringster Abweichung (nächster am Ziel gewinnt)
2. Alle Teilnehmer mit Messwert > Zielwert, sortiert nach geringster Abweichung

Ergebnis: Wer über dem Ziel liegt, kommt immer nach allen die darunter oder gleich sind.

### Liga-spezifisch: Punktevergabe (Gruppenphase)

| Ergebnis      | Sieger   | Verlierer |
| ------------- | -------- | --------- |
| Sieg          | 2 Punkte | 0 Punkte  |
| Kampflos-Sieg | 2 Punkte | 0 Punkte  |
| Unentschieden | 1 Punkt  | 1 Punkt   |
| Freilos       | 2 Punkte | —         |

### Liga-spezifisch: Unentschieden-Aufloesung

1. Bessere Serie (hoehere Ringsumme) → 2 Punkte
2. Besserer Teiler (kleinerer Wert, ggf. mit Faktor) → 2 Punkte
3. Kein Gewinner moeglich → beide 1 Punkt (DRAW)

### Liga-spezifisch: Tabellensortierung

1. Punkte (absteigend)
2. Direkter Vergleich bei Punktgleichstand
3. Bestes individuelles Ergebnis (niedrigster Ringteiler aus allen Gruppenspielen)

### Saison-spezifisch: Mehrfach-Wertung

Pro Teilnehmer werden drei Bestwerte ermittelt (jeweils aus einer einzelnen Serie):

- **Beste Ringe:** Serie mit höchster Ringzahl
- **Bester Teiler:** Serie mit niedrigstem korrigierten Teiler (Teiler \* Faktor)
- **Bester Ringteiler:** Serie mit niedrigstem Ringteiler (MaxRinge - Ringe + Teiler\*Faktor)

Wichtig: Beste Ringe und bester Teiler können aus **verschiedenen Serien** stammen. Ringteiler muss aus **derselben Serie** stammen (Ringe und Teiler gehören zusammen).

Nur Teilnehmer mit ≥ minSeries Serien werden gewertet.

---

## Glossar

| Begriff                     | Erklärung                                                                                                      |
| --------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Serie                       | Ergebnis eines Schießdurchgangs: N Schuss (default 10), erfasst als Gesamtringe + bester Teiler + Disziplin    |
| Teiler                      | Abstand Einschuss zur Scheibenmitte als Dezimalwert (z.B. 25.7); kleinerer Wert = näher an der Mitte           |
| Teiler-Faktor               | Korrekturfaktor pro Disziplin; gleicht unterschiedliche Schwierigkeitsgrade aus (z.B. LP /3, LG Auflage \*1.8) |
| Korrigierter Teiler         | Teiler \* Faktor; Basis für fairen Vergleich bei gemischten Disziplinen                                        |
| Ringteiler                  | MaxRinge − Ringe + (Teiler \* Faktor); je kleiner, desto besser                                                |
| Wettbewerb (Competition)    | Oberbegriff für Liga, Event und Saison                                                                         |
| Liga (LEAGUE)               | Rundenbasierter Wettbewerb mit Spielplan, Tabelle, Playoffs                                                    |
| Event (EVENT)               | Einmaliges Schießen (z.B. Kranzl); Rangliste aus einer Serie pro Teilnehmer                                    |
| Saison (SEASON)             | Langzeit-Wettbewerb; viele Serien über Monate, beste Einzelserien zählen                                       |
| Wertungsmodus (ScoringMode) | Bestimmt wie Ergebnisse verglichen/gereiht werden (7 Modi)                                                     |
| Zielwert                    | Vorgabewert bei TARGET-Modi; Teilnehmer schießen möglichst nah daran                                           |
| Ganzring-Disziplin          | Ringe ganzzahlig 0–10; Max. 100/Serie bei 10 Schuss (z.B. LP freistehend)                                      |
| Zehntelring-Disziplin       | Ringe 0.0–10.9; Max. 109/Serie bei 10 Schuss (z.B. LG Auflage)                                                 |
| Heimrecht                   | Erstgenannter Schütze in einer Liga-Paarung organisiert Termin                                                 |
| Round Robin                 | Jeder gegen jeden (Hin- und Rückrunde); nur Liga                                                               |
| Freilos                     | Kampfloser Sieg bei ungerader Teilnehmerzahl (2 Punkte); nur Liga                                              |
| Rückzug                     | Vorzeitiges Ausscheiden; alle Ergebnisse rückwirkend gestrichen                                                |
| Best-of-Five                | VF/HF-Format: wer zuerst 3 Duelle gewinnt, kommt weiter; konfigurierbar                                        |
| Finale-Modus                | Sondermodus im Liga-Finale; Wertung als Kriterien-Kette (Primary + optional 2 Tiebreaker); Default: nur Ringe  |
| Gastteilnehmer              | Nicht-Vereinsmitglied; kann an Events teilnehmen; isGuest-Flag                                                 |
| Mindestserien               | Saison: Anzahl Serien die ein Teilnehmer mindestens geschossen haben muss                                      |
| Meyton-Import               | Ergebnisübernahme aus Meyton-System via URL oder PDF                                                           |
| Vorschiessen                | Nicht erlaubt in Liga — beide Schützen müssen gleichzeitig am Stand antreten                                   |

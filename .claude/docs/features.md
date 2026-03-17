# Funktionale Anforderungen – Ringwerk

---

## Rollen & Berechtigungen

| Rolle                 | Berechtigungen                                                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Administrator (ADMIN) | Vollzugriff: Nutzerverwaltung, Wettbewerbe, Teilnehmer, Force-Delete                                                                              |
| Manager (MANAGER)     | Wettbewerbe erstellen/verwalten, Ergebnisse erfassen, Teilnehmer/Disziplinen verwalten — **kein** Zugriff auf Nutzerverwaltung, kein Force-Delete |
| Benutzer (USER)       | Ergebnisse und Tabellen einsehen (read-only)                                                                                                      |
| Gastteilnehmer        | Nimmt an einzelnen Events teil; kein Login erforderlich                                                                                           |

### Berechtigungsmatrix

| Aktion                               | ADMIN | MANAGER  | USER |
| ------------------------------------ | ----- | -------- | ---- |
| Wettbewerbe erstellen/bearbeiten     | Ja    | Ja       | Nein |
| Ergebnisse erfassen/korrigieren      | Ja    | Ja       | Nein |
| Teilnehmer verwalten                 | Ja    | Ja       | Nein |
| Disziplinen verwalten                | Ja    | Ja       | Nein |
| Playoffs starten/verwalten           | Ja    | Ja       | Nein |
| Wettbewerb archivieren/abschliessen  | Ja    | Ja       | Nein |
| Audit-Log einsehen                   | Ja    | Ja       | Nein |
| **Nutzerverwaltung** (/admin/\*)     | Ja    | **Nein** | Nein |
| **Force-Delete**                     | Ja    | **Nein** | Nein |
| **Rollen zuweisen**                  | Ja    | **Nein** | Nein |
| Ergebnisse/Tabellen ansehen          | Ja    | Ja       | Ja   |

---

## Disziplinen

- Mehrere Disziplinen parallel verfuegbar
- Parameter je Disziplin: Name, Kuerzel, Wertungsart (Ganz-/Zehntelringe), Max.Ringe/Schuss, teilerFaktor
- **teilerFaktor: Decimal(4,3)** mit Default 1.0 — Korrekturfaktor fuer gemischte Wertungen
  - Gueltige Range: 0.001 bis 9.999 (min. 0.001, max. 9.999)
  - Wird beim Erstellen/Bearbeiten in der UI als "Teiler-Faktor" angezeigt
  - In Disziplin-Listen: Badge mit "Faktor X.XXX" (z.B. "Faktor 0.333")
- Vorinstallierte Systemdisziplinen (automatisch angelegt beim ersten Start):

| Kuerzel | Name                | Wertungsart  | teilerFaktor    |
| ------- | ------------------- | ------------ | --------------- |
| LP      | Luftpistole         | Ganzringe    | 0.333 (/3)      |
| LG      | Luftgewehr          | Ganzringe    | 1.0             |
| LPA     | Luftpistole Auflage | Zehntelringe | 0.6 (/3 \* 1.8) |
| LGA     | Luftgewehr Auflage  | Zehntelringe | 1.8             |

- Admin: Disziplinen anlegen, bearbeiten, Faktor konfigurieren
- Loeschen nur ohne Wettbewerbsergebnisse; sonst **archivieren**
- Disziplin-Faktor jederzeit aenderbar (Aenderung wirkt auf zukuenftige Berechnungen)

---

## Wettbewerbe

### Überblick

Ringwerk kennt drei Wettbewerbstypen. Alle teilen dieselbe Scoring-Engine und den Teilnehmerpool.

| Typ                     | Ablauf                                        | Ergebnis                                     |
| ----------------------- | --------------------------------------------- | -------------------------------------------- |
| **Liga** (LEAGUE)       | Spielplan → Gruppenphase → Tabelle → Playoffs | Meister + Platzierungen                      |
| **Event** (EVENT)       | Anmeldung → Schiessen → Rangliste             | Rangliste (ggf. mit Zielwert)                |
| **Saison** (SEASON)     | Serien über Monate → Auswertung               | Mehrfach-Ranking (Ringe, Teiler, Ringteiler) |

### Gemeinsame Konfiguration

Jeder Wettbewerb hat:

- **Name** und **Status** (Entwurf → Aktiv → Abgeschlossen → Archiviert)
- **Wertungsmodus** (ScoringMode) — bestimmt wie Ergebnisse verglichen werden
- **Schusszahl pro Serie** (default 10, konfigurierbar, z.B. 5 für Kurz-Kranzl)
- **Disziplin** — fix (alle schießen dieselbe) oder **gemischt** (jeder wählt seine Disziplin, Faktor-Korrektur aktiv)

### Wertungsmodi (Scoring-Engine)

| Modus           | Formel                                | Gewinner    | Faktor              |
| --------------- | ------------------------------------- | ----------- | ------------------- |
| RINGTEILER      | MaxRinge - Ringe + (Teiler \* Faktor) | Niedrigster | Ja                  |
| RINGS           | Gesamtringe (ganzzahlig)              | Höchster    | Nein                |
| RINGS_DECIMAL   | Gesamtringe (Zehntelwertung)          | Höchster    | Nein                |
| TEILER          | Teiler \* Faktor                      | Niedrigster | Ja                  |
| DECIMAL_REST    | Nachkommastelle der Ringe summiert    | Höchster    | Nein                |
| TARGET_ABSOLUTE | Abweichung vom Zielwert               | Geringste   | Wenn Teiler-basiert |
| TARGET_UNDER    | ≤ Zielwert bevorzugt, dann Abweichung | Geringste   | Wenn Teiler-basiert |

Formeln und Details: siehe `data-model.md` → Berechnungsregeln.

---

## Liga-Modus (LEAGUE)

### Konfiguration

Eine Liga ist an **eine Disziplin gebunden** (oder gemischt mit Faktor-Korrektur).
Konfigurierbare Regelsets pro Liga:

| Parameter            | Default    | Beschreibung                              |
| -------------------- | ---------- | ----------------------------------------- |
| scoringMode          | RINGTEILER | Wertung Gruppenphase                      |
| shotsPerSeries       | 10         | Schuss pro Seite                          |
| playoffBestOf        | 3          | Siege zum Weiterkommen (3 = Best-of-Five) |
| playoffQualThreshold | 8          | Ab dieser TN-Zahl → VF statt HF           |
| playoffQualTopN1     | 4          | Qualifikanten für HF                      |
| playoffQualTopN2     | 8          | Qualifikanten für VF                      |
| finaleScoringMode    | RINGS      | Wertung Finale                            |
| finaleHasSuddenDeath | true       | Sudden Death bei Gleichstand              |

Regelset ist **nach Spielplan-Generierung gesperrt** — Änderungen nur vor dem ersten Spieltag.

### Spielplan-Generierung

- **Doppelrunden-Spielplan (Round Robin):** Hin- und Rückrunde
- Rückrunde spiegelt Hinrunde (Heimrecht getauscht)
- Ungerade Teilnehmerzahl → jeder bekommt einmal Freilos (2 Punkte)
- Mindest-Teilnehmerzahl: 4
- Regenerierung möglich solange keine abgeschlossenen Paarungen

### Heimrecht

- Zuerst genannte Person ist verantwortlich für Terminabsprache
- Mehrere Duelle an einem Abend möglich
- **Kein Vorschiessen** — beide Schützen müssen nebeneinander am Stand antreten

### Ergebniserfassung (Liga)

- Pro Paarung: beide Teilnehmer schießen je eine Serie
- **Pflichtfelder:** Gesamtringe + bester Teiler pro Teilnehmer
- **Optional:** Einzelschusswerte (Schuss 1–N) für Statistiken
- Automatische Berechnung des Ringteilers
- Nachträgliche Korrektur: nur durch Admin oder Schiedsrichter (AuditLog)

### Validierungsregeln

| Wertungsart  | Gültige Einzelwerte                                       |
| ------------ | --------------------------------------------------------- |
| Ganzringe    | 0–10, ganzzahlig                                          |
| Zehntelringe | 0.0 oder 1.0–10.9 (eine Dezimalstelle; 0.1–0.9 ungültig) |

- Seriensumme ≤ Schussanzahl × Max.Ringe/Schuss
- Teiler: 0.0–9999.9 (Dezimalwert)

### Tabelle & Rangliste

Sortierung absteigend:

1. Punkte
2. Direkter Vergleich (bei Punktgleichstand)
3. Bestes individuelles Ergebnis (niedrigster Ringteiler)

Anzeigespalten: Pl., Name, Spiele, Siege, Niederlagen, Punkte, bestes Ergebnis
Zurückgezogene Teilnehmer → Tabellenende mit Vermerk

### Playoff-Phase (K.O.-System)

#### Qualifikation

| Teilnehmer | Qualifikanten      | Einstieg      |
| ---------- | ------------------ | ------------- |
| 4–7        | Top N1 (default 4) | Halbfinale    |
| 8+         | Top N2 (default 8) | Viertelfinale |

Seeding: 1 vs. letzter, 2 vs. vorletzter, usw.

#### Start-Voraussetzungen

- Wettbewerb muss ACTIVE sein
- Playoffs noch nicht gestartet
- Mindestens 4 aktive Teilnehmer
- Keine PENDING-Paarungen in der Gruppenphase

#### Best-of-N (VF & HF)

- Wer zuerst `playoffBestOf` Duelle gewinnt, zieht weiter (default 3 = Best-of-Five)
- Pro Duell: eine Serie je Teilnehmer, Wertung gemäß `scoringMode`
- Bei Unentschieden: nächstes Duell wird automatisch angelegt
- Admin legt jedes Duell manuell an

#### Rundenfortschritt

- Nach Abschluss aller Matches: Admin löst nächste Runde manuell aus
- Re-Seeding nach Original-Gruppenrang

#### Finale (Sondermodus)

| Regel            | Beschreibung                                                       |
| ---------------- | ------------------------------------------------------------------ |
| Wertung          | gemäß `finaleScoringMode` (default: nur Ringe, höchste gewinnt)    |
| Gleichstand      | wenn `finaleHasSuddenDeath`: weiteres Duell bis Entscheid          |
| Einrichtungszeit | 3 Minuten                                                          |
| Probeschuss      | Keiner                                                             |
| Ansage           | Jeder Schuss einzeln                                               |
| Zeit pro Schuss  | 75 Sekunden                                                        |

App-Umfang: **nur Ergebniserfassung** (keine Zeitnahme oder Ansage-Unterstützung)

#### Korrekturen & Löschungen

- **canCorrect-Flag:** Korrekturen erlaubt solange Folgerunde keine Duelle hat
- Korrektur: Siegstand wird neu berechnet; leere Folge-Matches kaskadierend gelöscht
- Löschen des letzten Duells: nur bei canCorrect

#### Guards

- **Rueckzug:** nach Playoff-Start gesperrt
- **Spielplan-Editierung:** nach Playoff-Start gesperrt

### Meyton-Import

- **Via URL:** System ruft Meyton-URL ab, parst Ergebnis
- **Via PDF-Upload:** Textbasiertes PDF, kein OCR
- Sicherheitsgrenzen: Timeout 15s, max. 10 MB; PDF max. 2 MB/Stream, 8 MB gesamt (nur bei Liga)

---

## Event-Modus (EVENT)

### Konzept

Ein Event bildet ein einmaliges Schiessen ab (z.B. Kranzlschiessen, Pokalschiessen, Spassschiessen).
Alle Teilnehmer schiessen, eine Rangliste wird erstellt.

### Konfiguration

| Parameter       | Beschreibung                                                |
| --------------- | ----------------------------------------------------------- |
| scoringMode     | Wertungsmodus (alle 7 Modi möglich)                         |
| shotsPerSeries  | Schusszahl pro Serie (default 10, z.B. 5 für Kurz-Kranzl)   |
| disciplineId    | null = gemischt (Faktor aktiv), oder fixe Disziplin         |
| eventDate       | Veranstaltungsdatum                                         |
| allowGuests     | Gastteilnehmer zugelassen                                   |
| teamSize        | null = Einzel; 2+ = Teamgröße                              |
| targetValue     | Zielwert für TARGET-Modi (z.B. 512 oder 76.0)              |
| targetValueType | TEILER, RINGS oder RINGS_DECIMAL                            |

### Teilnehmer & Gäste

- Vereinsmitglieder werden aus dem Teilnehmerpool eingeschrieben
- Gäste: werden als Participant angelegt mit `isGuest: true` auf CompetitionParticipant
- Bei gemischten Disziplinen: jeder Teilnehmer wählt seine Disziplin bei der Anmeldung

### Serien-Erfassung

- Jeder Teilnehmer schießt **eine Serie** pro Event
- Admin erfasst: Gesamtringe + Teiler (+ optional Einzelschüsse)
- Bei DECIMAL_REST-Modus: Einzelschüsse sind **Pflicht** (Nachkommastellen benötigt)

### Rangliste

- Berechnung gemaess scoringMode mit Faktor-Korrektur (bei gemischten Disziplinen)
- Anzeige: Platzierung, Name, Disziplin, Ringe, Teiler (korrigiert), Ergebniswert

### Zielwert-Modus

Nur bei Events. Zwei Varianten:

**TARGET_ABSOLUTE:** Möglichst nah an den Zielwert — ob drüber oder drunter ist egal.

**TARGET_UNDER:** ≤ Zielwert wird bevorzugt.

- Erst alle die den Zielwert nicht überschritten haben (sortiert nach Nähe)
- Dann alle die drüber sind (sortiert nach Nähe)

Bei Teiler-basiertem Zielwert: Faktor-Korrektur wird auf den gemessenen Teiler angewendet. Der Zielwert ist im korrigierten Raum definiert.

### Team-Erweiterung (spätere Phase)

- teamSize auf Competition setzen (z.B. 2 für Zweierteams)
- Admin teilt Teams ein
- Jedes Teammitglied schießt eine Serie
- Team-Ergebnis = Summe der Einzelergebnisse
- Ranking nach Team-Ergebnis

---

## Saison-Modus (SEASON)

### Konzept

Ein Saison-Wettbewerb läuft über mehrere Monate (z.B. Jahrespreisschiessen).
Teilnehmer schießen viele Serien über die Saison hinweg. Die besten Einzelserien zählen.
Serien werden "gekauft" — jede geschossene Serie zählt als gekauft.

### Konfiguration

| Parameter      | Beschreibung                                                             |
| -------------- | ------------------------------------------------------------------------ |
| scoringMode    | Primärer Wertungsmodus (für die Hauptsortierung)                         |
| shotsPerSeries | Schusszahl pro Serie                                                     |
| disciplineId   | Immer null (gemischt) — Teilnehmer können Disziplin pro Serie wechseln   |
| minSeries      | Mindestanzahl Serien für Wertung (default 20)                            |
| seasonStart    | Saisonbeginn                                                             |
| seasonEnd      | Saisonende                                                               |

### Serien-Erfassung

- Über mehrere Schießabende hinweg
- Pro Eintrag: Gesamtringe, Teiler, Disziplin, Datum
- Teilnehmer kann Disziplin pro Serie frei wählen
- Keine Begrenzung der Serienanzahl nach oben

### Mehrfach-Wertung

Die Saison-Tabelle zeigt **drei Bestwerte** pro Teilnehmer (jeweils aus einer einzelnen Serie):

| Kategorie         | Berechnung                                         | Gewinner    |
| ----------------- | -------------------------------------------------- | ----------- |
| Beste Ringe       | Höchste Ringzahl einer einzelnen Serie             | Höchster    |
| Bester Teiler     | Niedrigster korrigierter Teiler (Teiler \* Faktor) | Niedrigster |
| Bester Ringteiler | Niedrigster Ringteiler einer einzelnen Serie       | Niedrigster |

**Wichtig:** Beste Ringe und bester Teiler können aus **verschiedenen Serien** stammen.
Ringteiler muss aus **derselben Serie** stammen (Ringe und Teiler gehören zusammen).

### Mindestserien-Prüfung

- Nur Teilnehmer mit ≥ minSeries geschossenen Serien erscheinen in der Wertung
- Teilnehmer mit weniger Serien werden angezeigt, aber ausgegraut / nicht gewertet
- Fortschrittsanzeige: "12 / 20 Serien geschossen"

---

## Teilnehmerverwaltung

- Felder: Name, Vorname, Kontaktmoeglichkeit (E-Mail oder Telefon, Pflicht)
- Teilnahme in mehreren Wettbewerben gleichzeitig moeglich
- Startnummer pro Wettbewerb (optional)

### Gastschützen

- Können an Events teilnehmen (wenn `allowGuests` aktiviert)
- Werden als Participant im System angelegt (wiederverwendbar für zukünftige Events)
- Markierung via `isGuest` auf CompetitionParticipant
- Kein Login erforderlich — Ergebnisse werden vom Admin erfasst

### Rückzug (nur Liga)

- Jederzeit möglich (auch nach gespielten Runden)
- Alle Ergebnisse des Teilnehmers rückwirkend aus der Wertung
- Tabelle wird neu berechnet
- Rückzug rückgängig machbar (solange Playoffs nicht begonnen)
- Protokollierung im Audit-Log

---

## Visualisierung & Auswertung

- **Liga:** Interaktive Tabelle, K.O.-Bracket, Punkteverlauf (Liniendiagramm)
- **Event:** Rangliste mit Disziplin, Ergebniswert und Faktor-Korrektur
- **Saison:** Mehrfach-Tabelle (Ringe, Teiler, Ringteiler), Serien-Verlauf, Fortschrittsanzeige
- **Alle:** Paarungsplan/Serienliste, Profil-Seite je Teilnehmer
- Export: Spielplan + Tabelle als druckoptimiertes PDF (nur Liga)

---

## Nutzerverwaltung & Zugriffskontrolle

- Konten ausschließlich durch Admins erstellt (kein Self-Signup)
- Rollen: Administrator (Vollzugriff) | Benutzer (eingeschränkt)
- Admin: Nutzer anlegen, bearbeiten, Passwörter zurücksetzen
- Eigenes Passwort ändern: nur eingeloggt + aktuelles Passwort
- Passwort vergessen: nur Admin-Reset, kein E-Mail-Flow
- Alle Wettbewerbs-, Teilnehmer- und Disziplindaten sind vereinsweit sichtbar; Zugangskontrolle via Rolle, nicht via userId

### Archivieren statt Löschen

- Disziplinen mit Ergebnissen → archivieren
- Wettbewerbe mit Ergebnissen → archivieren
- Archivierte Objekte: nicht in Auswahlfeldern; historische Daten abrufbar
- Explizite Löschung: nur ohne abhängige Daten
- Force Delete (Admin): Wettbewerb inkl. aller Daten löschen (Bestätigung durch Namenseingabe)

---

## Audit-Log (Protokoll)

- Alle sicherheits- und verwaltungsrelevanten Aktionen werden protokolliert
- `competitionId` als Referenz (statt `leagueId`)
- Ereignistypen (erweiterbar für Event/Saison):

| Ereignis                 | Auslöser                           |
| ------------------------ | ---------------------------------- |
| PARTICIPANT_WITHDRAWN    | Rückzug eines Teilnehmers          |
| WITHDRAWAL_REVOKED       | Rückzug rückgängig                 |
| RESULT_ENTERED           | Ergebnis eingetragen               |
| RESULT_CORRECTED         | Ergebnis korrigiert                |
| PLAYOFFS_STARTED         | Playoff-Phase gestartet            |
| PLAYOFF_RESULT_ENTERED   | Playoff-Duell-Ergebnis eingetragen |
| PLAYOFF_RESULT_CORRECTED | Playoff-Duell korrigiert           |
| PLAYOFF_DUEL_DELETED     | Playoff-Duell gelöscht             |

- Details-JSON als Snapshot (denormalisiert, kein Verweis)
- Wettbewerb-Protokoll: pro Wettbewerb; Globales Protokoll: alle Wettbewerbe

---

## Datenschutz

- Personenbezogene Daten nur fuer Vereinsverwaltung
- Keine Weitergabe an Dritte
- On-Premise auf TrueNAS, kein Cloud-Dienst
- HTTPS in Produktion zwingend

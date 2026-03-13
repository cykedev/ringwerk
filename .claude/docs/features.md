# Funktionale Anforderungen – 1-gegen-1 Liga-App

---

## Rollen & Berechtigungen

| Rolle          | Berechtigungen                                                         |
| -------------- | ---------------------------------------------------------------------- |
| Administrator  | Vollzugriff: Spieler anlegen, Spielplan, Ergebnisse, Liga abschliessen |
| Schiedsrichter | Ergebnisse eintragen für zugewiesene Paarungen                         |
| Teilnehmer     | Eigene Ergebnisse und Spielplan einsehen                               |
| Zuschauer      | Ligatabelle und Ergebnisse (read-only)                                 |

---

## Disziplinen & Ligakonfiguration

- Mehrere Disziplinen parallel, jede mit eigener Liga
- Parameter je Disziplin: Name, Wertungsart (Ganz- / Zehntelringe), Max. Ringe/Schuss, Schiessabende
- Vorinstallierte Standarddisziplinen:

| Kürzel | Name                | Wertungsart  |
| ------ | ------------------- | ------------ |
| LP     | Luftpistole         | Ganzringe    |
| LG     | Luftgewehr          | Ganzringe    |
| LPA    | Luftpistole Auflage | Zehntelringe |
| LGA    | Luftgewehr Auflage  | Zehntelringe |

- Schiessabende werden je Liga beim Anlegen konfiguriert
- Admin: Disziplinen anlegen, bearbeiten; löschen nur ohne Ligaergebnisse
- Mit Ligaergebnissen → **archivieren** (nicht löschen); historische Daten bleiben erhalten
- Disziplin einer Liga ist nach Erstellung unveränderlich
- Mehrere Ligen gleichzeitig aktiv; Teilnehmer in mehreren Ligen möglich

## Ringteiler-Wertungssystem

**Formel:** `Ringteiler = Max.Ringe − erreichte Ringe + Teiler`

- Teiler = Abstand Einschuss zur Scheibenmitte als **Dezimalwert** (z.B. 25,7); direkt in der Formel verwendet, keine Umrechnung
- **Niedrigerer Ringteiler gewinnt**
- Jede Seite = genau 10 Schuss, kein Probeschuss
- Absoluter Gleichstand (identischer Ringteiler) → Unentschieden

Beispiel Ganzringe (Max. 100): A: 96 Ringe, Teiler 3,7 → RT 7,7 | B: 96 Ringe, Teiler 4,2 → RT 8,2 → A gewinnt

Beispiel Zehntelringe (Max. 109): A: 104,5 Ringe, Teiler 2,1 → RT 6,6 | B: 105,0 Ringe, Teiler 1,8 → RT 5,8 → B gewinnt

## Punktevergabe (Gruppenphase)

| Ergebnis      | Sieger   | Verlierer |
| ------------- | -------- | --------- |
| Sieg          | 2 Punkte | 0 Punkte  |
| Kampflos-Sieg | 2 Punkte | 0 Punkte  |
| Unentschieden | 1 Punkt  | 1 Punkt   |

### Unentschieden-Auflösung

Identischer Ringteiler wird in dieser Reihenfolge aufgelöst:

1. **Bessere Serie** (höhere Seriensumme) → Gewinner bekommt 2 Punkte
2. **Besserer Teiler** (kleinerer Wert) → Gewinner bekommt 2 Punkte
3. **Kein Gewinner möglich** → beide bekommen 1 Punkt (DRAW)

---

## Teilnehmerverwaltung

- Felder: Name, Vorname, Kontaktmöglichkeit (E-Mail oder Telefon)
- Mindest-Teilnehmerzahl: 4 pro Disziplin/Liga
- Startnummer pro Saison und Liga; Teilnahme in mehreren Ligen möglich

### Rückzug

- Jederzeit möglich (auch nach gespielten Runden)
- **Alle** bereits gespielten Ergebnisse des Teilnehmers werden rückwirkend aus der Wertung genommen
- Tabelle wird vollständig neu berechnet
- Zurückgezogener Teilnehmer: am Tabellenende mit Vermerk, keine Playoff-Teilnahme
- Rückzug rückgängig machbar (solange Playoffs nicht begonnen haben) → Ergebnisse werden wiederhergestellt
- Admin legt Zeitpunkt und optionale Begründung fest
- Protokollierung im Audit-Log

---

## Spielplan-Generierung

- **Doppelrunden-Spielplan (Round Robin):** Hin- und Rückrunde
- Rückrunde spiegelt Hinrunde (Heimrecht getauscht)
- Ungerade Teilnehmerzahl → jeder bekommt einmal Freilos (2 Punkte)
- Alle Duelle einer Runde bis Stichtag abschliessen

### Heimrecht

- Zuerst genannte Person ist verantwortlich für Terminabsprache
- Mehrere Duelle an einem Abend möglich
- **Kein Vorschießen** – beide Schützen müssen nebeneinander am Stand antreten
- System zeigt Heimschützen offene Duelle mit Kontaktdaten des Gegners

---

## Ergebniserfassung

- **Pflichtfelder:** Seriensumme (Gesamtringe) + bester Teiler
- **Optional:** Einzelschusswerte (Schuss 1–10) für spätere Statistiken
- Automatische Berechnung des Ringteilers aus Seriensumme + Teiler
- Wenn Einzelschüsse erfasst: Seriensumme wird daraus berechnet
- Nachträgliche Korrektur: nur durch Admin oder Schiedsrichter

### Validierungsregeln (clientseitig, ungültige Felder rot, Speichern blockiert)

| Wertungsart  | Gültige Einzelwerte                                      |
| ------------ | -------------------------------------------------------- |
| Ganzringe    | 0–10, ganzzahlig                                         |
| Zehntelringe | 0,0 oder 1,0–10,9 (eine Dezimalstelle; 0,1–0,9 ungültig) |

- Seriensumme ≤ Schussanzahl × Max.Ringe/Schuss
- Teiler: 0,0–9999,9 (Dezimalwert)
- Leere Felder = kein Fehler

### Meyton-Import

- **Via URL:** System ruft Meyton-URL ab, parst Ergebnis, befüllt Felder
- **Via PDF-Upload:** Textbasiertes PDF, kein OCR; Extraktion von Ringen und Teiler
- Serien erkannt via Muster `Serie <n>:`; Schusswerte bis nächste Serie oder Dokumentende
- Gültige Parser-Werte: 0,0–10,9 für Einzelschüsse; `*` (Innnenzehner), und Footer-Angaben werden ignoriert
- Teiler `T` müssen erfasst werden
- Ganzring-Disziplin: importierte Zehntelwerte per Floor umgerechnet (9,7 → 9)
- Bestehende Formulareinträge werden ersetzt; Speichern erst nach manueller Prüfung
- Fehler → harter Abbruch mit Fehlermeldung, kein Teilimport
- Sicherheitsgrenzen: Timeout 15s, keine Redirects, max. 10 MB; PDF: max. 2 MB/Flate-Stream, max. 8 MB gesamt, max. 25.000 Text-Tokens

---

## Tabelle & Rangliste

Sortierung absteigend:

1. Punkte
2. Direkter Vergleich (bei Punktgleichstand)
3. Bestes individuelles Ergebnis (niedrigster Ringteiler aus allen Gruppenduellen)

Anzeigespalten: Pl., Name, Spiele, Siege, Niederlagen, Punkte, bestes Ergebnis (Ringteiler)
Zurückgezogene Teilnehmer → Tabellenende mit Vermerk

---

## Playoff-Phase (K.O.-System)

### Qualifikation

| Anmeldungen | Qualifikanten | Einstieg      |
| ----------- | ------------- | ------------- |
| 4–7         | 4 beste       | Halbfinale    |
| 8+          | 8 beste       | Viertelfinale |

Viertelfinale-Paarung: 1 vs. 8 | 2 vs. 7 | 3 vs. 6 | 4 vs. 5
Halbfinale: bester verbleibender Gruppenplatz vs. schlechtester usw.

### Start-Voraussetzungen

- Liga muss ACTIVE sein
- Playoffs noch nicht gestartet
- Mindestens 4 aktive (nicht zurückgezogene) Teilnehmer
- Keine PENDING-Paarungen in der Gruppenphase

### Best-of-Five (VF & HF)

- Wer zuerst 3 Einzel-Duelle gewinnt, zieht weiter
- Pro Duell: 10 Schuss, Ring- und Teilerwertung (identisch zur Gruppenphase)
- Duelle können an verschiedenen Abenden oder mehrere an einem Abend stattfinden
- Kein Vorschießen
- Admin legt jedes Duell manuell an; bei Unentschieden wird das nächste Duell automatisch angelegt (kein hartes Limit)

### Rundenfortschritt (manuell)

- Nach Abschluss aller Matches einer Runde erscheint ein **„Halbfinale/Finale anlegen"**-Button (nur Admin)
- Der Admin löst damit manuell das Seeding für die nächste Runde aus
- Nächste Runde wird erst nach expliziter Bestätigung angelegt (kein Automatismus)
- Seeding HF: Re-Seeding nach Original-Gruppenrang (beste verbleibende vs. schlechteste verbleibende)
- Seeding Finale: erster HF-Gewinner vs. zweiter HF-Gewinner

### Finale (Sondermodus)

Alle Disziplinen am selben Finalabend, separat gewertet.

| Regel            | Wert                                                                      |
| ---------------- | ------------------------------------------------------------------------- |
| Einrichtungszeit | 3 Minuten                                                                 |
| Probeschuss      | Keiner                                                                    |
| Ansage           | Jeder Schuss einzeln                                                      |
| Zeit pro Schuss  | 75 Sekunden                                                               |
| Wertung          | Nur Gesamtringe (kein Teiler im Finale); höchste Ringzahl gewinnt         |
| Gleichstand      | Automatisches Sudden-Death-Duell (weiteres 10-Schuss-Duell) bis Entscheid |

- Finale-Modus separat im System abbilden
- Ergebnisse separat speichern und visualisieren
- App-Umfang: **nur Ergebniserfassung** (keine aktive Zeitnahme oder Ansage-Unterstützung)

### Korrekturen & Löschungen

- **`canCorrect`-Flag:** Ob Korrekturen und Duel-Löschungen für ein Match erlaubt sind
  - Finale: immer korrigierbar
  - VF/HF: nur korrigierbar, solange die Folge-Runde für dieses Match noch keine Duelle hat
- **Korrektur eines Duel-Ergebnisses:** Siegstand wird neu berechnet; bereits abgeschlossene Folge-Runden-Matches ohne Duelle werden kaskadierend gelöscht
- **Löschen des letzten Duells:** nur möglich solange `canCorrect` gilt; Siege werden entsprechend korrigiert; leere Folge-Runden-Matches werden kaskadierend gelöscht

### Guards (Playoff-Start blockiert weitere Aktionen)

- **Spieler-Rückzug:** Nach Playoff-Start können keine Teilnehmer mehr zurückgezogen oder Rückzüge rückgängig gemacht werden (`LeagueParticipantActions` rendert `null` wenn `playoffsStarted = true`)
- **Spielplan-Editierung:** Nach Playoff-Start ist das Eintragen und Korrigieren von Gruppenphase-Ergebnissen gesperrt (`ScheduleView` übergibt `isAdmin = false` an `LegTable` wenn `playoffsStarted = true`)

---

## Visualisierung & Auswertung

- Interaktive Ligatabelle mit Sortierfunktion
- K.O.-Baum (Bracket-Ansicht) mit aktuellem Stand
- Verlaufsanzeige: Punkteentwicklung je Teilnehmer (Liniendiagramm)
- Paarungsplan: kalender- oder listenbasiert, offen/abgeschlossen
- Profil-Seite je Teilnehmer: alle Duelle, Ergebnisse, Statistiken
- Export: Spielplan + Tabelle als druckoptimiertes PDF (`src/lib/pdf/SchedulePdf.tsx`); Playoffs-PDF separat (`PlayoffsPdf.tsx`)

---

## Nutzerverwaltung & Zugriffskontrolle

- Konten ausschliesslich durch Admins erstellt (kein Self-Signup)
- Rollen: Administrator (Vollzugriff) | Benutzer (eingeschränkt)
- Admin kann: Nutzer anlegen, bearbeiten (Name, E-Mail für Benutzer, Rolle, Status), Passwörter zurücksetzen
- Eigenes Passwort ändern: nur eingeloggt + aktuelles Passwort erforderlich
- Passwort vergessen: nur Admin-Reset, kein automatischer E-Mail-Flow
- Alle Liga-, Teilnehmer- und Disziplindaten sind vereinsweit sichtbar (keine per-User-Isolation); Zugangskontrolle erfolgt via Rolle (ADMIN / USER), nicht via userId-Filter

### Archivieren statt Löschen

Gilt für alle Datenobjekte mit abhängigen Daten:

- Disziplinen mit Ligaergebnissen → archivieren
- Ligen mit Duell-Ergebnissen → archivieren
- Archivierte Objekte: nicht mehr in Auswahlfeldern; historische Daten vollständig abrufbar
- Explizite Löschung (mit Datenverlust): nur ohne abhängige Daten möglich

### Liga endgültig löschen (Force Delete)

- Nur Admin; auf der Liga-Edit-Seite in einer rot umrandeten Gefahrenzone
- Löscht die Liga unabhängig von Status und Spielfortschritt (auch mit Ergebnissen und Playoffs)
- Admin muss exakten Liga-Namen eintippen (case-sensitive) zur Bestätigung
- Löscht in einer DB-Transaktion in dieser Reihenfolge: PlayoffDuelResults → PlayoffDuels → PlayoffMatches → MatchResults → Matchups → AuditLog-Einträge → LeagueParticipants → League

---

## Audit-Log (Protokoll)

- Alle sicherheitsrelevanten und verwaltungsrelevanten Aktionen werden automatisch protokolliert
- Protokollierte Ereignisse (8 Typen):

| Ereignis                   | Auslöser                                      |
| -------------------------- | --------------------------------------------- |
| `PARTICIPANT_WITHDRAWN`    | Rückzug eines Teilnehmers                     |
| `WITHDRAWAL_REVOKED`       | Rückzug rückgängig gemacht                    |
| `RESULT_ENTERED`           | Gruppenphase-Ergebnis erstmalig eingetragen   |
| `RESULT_CORRECTED`         | Gruppenphase-Ergebnis nachträglich korrigiert |
| `PLAYOFFS_STARTED`         | Playoff-Phase gestartet                       |
| `PLAYOFF_RESULT_ENTERED`   | Playoff-Duell-Ergebnis eingetragen            |
| `PLAYOFF_RESULT_CORRECTED` | Playoff-Duell-Ergebnis korrigiert             |
| `PLAYOFF_DUEL_DELETED`     | Playoff-Duell gelöscht                        |

- Jeder Eintrag enthält: Ereignistyp, Liga-Referenz (`leagueId`), betroffene Entität, auslösender User, Zeitstempel, strukturierte Details (JSON)
- Teilnehmer-Namen werden zum Schreibzeitpunkt im Details-JSON gespeichert (`homeName`/`awayName` für Gruppenphase, `nameA`/`nameB` für Playoffs)
- **Liga-Protokoll:** `/leagues/[id]/audit-log` — nur Admin; erreichbar über das `...`-Menü auf der Liga-Seite
- **Globales Protokoll:** `/admin/audit-log` — alle Ereignisse aller Ligen; nur Admin
- Farbige Badges je Ereigniskategorie; expandierbare Detail-Ansicht je Eintrag; Teilnehmerkontext-Zeile

---

## Datenschutz

- Personenbezogene Daten nur für Vereinsverwaltung
- Keine Weitergabe an Dritte
- On-Premise auf TrueNAS, kein Cloud-Dienst
- HTTPS in Produktion zwingend

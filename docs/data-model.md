# Datenmodell & Glossar – Liga-App

---

## Kernentitäten (konzeptionell)

### Benutzer (User)

- E-Mail, Passwort (bcrypt), Rolle (Admin | Benutzer), Status
- Datenisolation: alle untergeordneten Entitäten gehören einem User

### Disziplin

- Name, Wertungsart (GANZRING | ZEHNTELRING), Max.Ringe/Schuss, Schiessabende
- Status: aktiv | archiviert
- Archiviert wenn Ligaergebnisse vorhanden (niemals gelöscht)

### Liga

- Verknüpft mit einer Disziplin (unveränderlich nach Erstellung)
- Status: aktiv | abgeschlossen | archiviert
- Stichtage für Hin- und Rückrunde

### Teilnehmer

- Name, Vorname, Kontaktmöglichkeit (E-Mail oder Telefon, Pflicht)
- Startnummer pro Saison/Liga
- Kann in mehreren Ligen eingeschrieben sein
- Status: aktiv | zurückgezogen

### Spielplan / Paarung (Matchup)

- Heimschütze, Gastschütze, Runde (Hin/Rück), Status (offen | abgeschlossen | Freilos | kampflos)
- Stichtag

### Duell-Ergebnis (Result)

- Verknüpft mit Paarung und Schütze
- Einzelschüsse 1–10 (optional), Gesamtringe, Teiler, berechneter Ringteiler
- Meyton-Import-Quelle (URL | PDF | manuell)
- Erfasst von (User), Zeitstempel, letzte Änderung

### Playoff-Paarung

- Runde (VF | HF | Finale), Schütze A, Schütze B
- Best-of-Five-Stand (Siege A, Siege B)
- Einzelne Duelle mit je eigenem Ergebnis

### Audit-Log

- Pflichtfelder: Ereignistyp, betroffene Entität (`entityId`), auslösender User, Zeitstempel, Details (JSON)
- Optionale Liga-Referenz: `leagueId` (FK auf `League`); gesetzt für alle liga-spezifischen Ereignisse
- 8 protokollierte Ereignistypen:
  - `PARTICIPANT_WITHDRAWN`, `WITHDRAWAL_REVOKED` — Teilnehmer-Rückzug
  - `RESULT_ENTERED`, `RESULT_CORRECTED` — Gruppenphase-Ergebnisse
  - `PLAYOFFS_STARTED`, `PLAYOFF_RESULT_ENTERED`, `PLAYOFF_RESULT_CORRECTED`, `PLAYOFF_DUEL_DELETED` — Playoff-Phase
- Details-JSON enthält Kontext zum Schreibzeitpunkt:
  - Gruppenphase: `homeName`, `awayName`, Runde, Ringteiler-Werte
  - Playoffs: `nameA`, `nameB`, Match-Runde, Duell-Nummer
- Beim Force-Delete einer Liga: alle zugehörigen AuditLog-Einträge werden via `leagueId` gelöscht (kein `onDelete: Cascade` im Schema — manuelle Transaktion)

---

## Berechnungsregeln

### Ringteiler

```
Ringteiler = MaxRinge − Seriensumme + bester Teiler der Serie
```

- Teiler = Dezimalwert, direkt in Formel verwendet; bester Teiler = kleinster Wert der Serie (Schuss nächste zur Mitte)
- MaxRinge: 100 (Ganzring) | 109 (Zehntelring)
- Niedrigerer Ringteiler gewinnt

### Tabellenberechnung

1. Punkte (2 Sieg, 1 Unentschieden, 0 Niederlage, Freilos = 2)
2. Direkter Vergleich bei Punktgleichstand
3. Bestes individuelles Ergebnis (niedrigster Ringteiler aller Gruppenduelle)

### Playoff-Qualifikation

- 4–7 Teilnehmer: Top 4 → Halbfinale
- 8+ Teilnehmer: Top 8 → Viertelfinale (1vs8, 2vs7, 3vs6, 4vs5)

---

## Glossar

| Begriff               | Erklärung                                                                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Seite                 | Wettkampf-Durchgang: 10 Schuss, kein Probeschuss                                                                                            |
| Teiler                | Abstand Einschuss zur Scheibenmitte als Dezimalwert (z.B. 25,7); kleinerer Wert = näher an der Mitte; direkt in Ringteiler-Formel verwendet |
| Ringteiler            | `MaxRinge − Seriensumme + bester Teiler der Serie`; je kleiner, desto besser                                                                |
| Ganzring-Disziplin    | Ringe ganzzahlig 0–10; Max. 100/Seite (z.B. LP 10m freihändig)                                                                              |
| Zehntelring-Disziplin | Ringe 0,0–10,9; Max. 109/Seite (z.B. LG Auflage)                                                                                            |
| Liga                  | Disziplinspezifische Wettbewerbsreihe mit Spielplan, Tabelle, Playoffs                                                                      |
| Heimrecht             | Erstgenannter Schütze organisiert Termin                                                                                                    |
| Round Robin           | Jeder gegen jeden (Hin- und Rückrunde)                                                                                                      |
| Freilos               | Kampfloser Sieg bei ungerader Teilnehmerzahl (3 Punkte)                                                                                     |
| Rückzug               | Vorzeitiges Ausscheiden; alle Ergebnisse rückwirkend gestrichen                                                                             |
| Best-of-Five          | Wer zuerst 3 Duelle gewinnt, kommt weiter; bei Unentschieden wird automatisch ein weiteres Duell angelegt (kein hartes Limit)               |
| Finale-Modus          | 75s/Schuss, kein Probeschuss, Ansage je Schuss; Wertung immer gemäss Disziplin-Definition; Gleichstand → Sudden Death (Schuss für Schuss)   |
| Meyton-Import         | Ergebnisübernahme aus Meyton-System via URL oder PDF                                                                                        |
| Vorschießen           | Nicht erlaubt – beide Schützen müssen gleichzeitig am Stand antreten                                                                        |

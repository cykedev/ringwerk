# Code Conventions – 1-gegen-1 Liga-App

Verbindlich gleichrangig mit `.claude/docs/technical.md`.

## Index

- [Benennungsregeln](#benennungsregeln)
- [Enums (vollständige Liste)](#enums)
- [TypeScript-Regeln](#typescript-regeln)
- [Zod v4](#zod-v4)
- [React 19 useActionState](#react-19-useactionstate)
- [Dateistruktur einer Komponente](#dateistruktur-einer-komponente)
- [Server Actions](#server-actions)
- [Datenbankzugriffe](#datenbankzugriffe)
- [Kommentare](#kommentare)
- [Fehlerbehandlung](#fehlerbehandlung)
- [Testing](#testing)

---

## Benennungsregeln

| Was                    | Konvention                         | Beispiel                 |
| ---------------------- | ---------------------------------- | ------------------------ |
| Dateien (Komponenten)  | PascalCase, englisch               | `MatchResult.tsx`        |
| Dateien (Logik/Utils)  | camelCase                          | `calculateRingteiler.ts` |
| React-Komponenten      | PascalCase, englisch               | `function MatchResult()` |
| Funktionen & Variablen | camelCase                          | `const bestTeiler`       |
| Konstanten (global)    | SCREAMING_SNAKE_CASE               | `const MAX_SHOTS = 10`   |
| Prisma-Modelle         | PascalCase                         | `model League`           |
| Enum-Werte             | SCREAMING_SNAKE_CASE, **englisch** | `WHOLE`, `WITHDRAWN`     |
| TypeScript-Interfaces  | PascalCase, kein `I`-Präfix        | `interface MatchData`    |
| Routen / URL-Segmente  | lowercase-kebab-case, englisch     | `/leagues/new`           |

---

## Enums

Alle Enum-Werte sind **englisch** und **SCREAMING_SNAKE_CASE**.

### Wertungsart (Disziplin)

```
WHOLE      – Ganzringe
DECIMAL    – Zehntelringe
```

### Liga-Status

```
ACTIVE
COMPLETED
ARCHIVED
```

### Teilnehmer-Status (in einer Liga)

```
ACTIVE
WITHDRAWN   – zurückgezogen
```

### Paarung-Status (Gruppenphase)

```
PENDING     – noch nicht ausgetragen
COMPLETED   – Ergebnis eingetragen
BYE         – Freilos (kampfloser Sieg bei ungerader Teilnehmerzahl)
WALKOVER    – Kampflos-Sieg (Gegner unangekündigt nicht erschienen)
```

Hinweis: Playoff-Einzel-Duelle haben kein eigenes Status-Enum, sondern `isCompleted: Boolean`.

### Runde (Gruppenphase)

```
FIRST_LEG   – Hinrunde
SECOND_LEG  – Rückrunde
```

### Playoff-Runde

```
QUARTER_FINAL
SEMI_FINAL
FINAL
```

### Nutzer-Rolle

```
ADMIN
USER
```

### Ergebnis-Importquelle

```
MANUAL
URL
PDF
```

---

## Shared Types (`src/lib/types.ts`)

### ActionResult

Einzige erlaubte Rückgabestruktur für alle Server Actions:

```typescript
// src/lib/types.ts
export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { error: string | Record<string, string[] | undefined> }
```

**Verwendung:**

```typescript
// Allgemeiner Fehler
return { error: "Nicht angemeldet" }

// Validierungsfehler (Zod fieldErrors)
return { error: parsed.error.flatten().fieldErrors }

// Erfolg ohne Daten
return { success: true }

// Erfolg mit Daten
return { success: true, data: result }

// Auswerten im Client
if ("error" in result) {
  // Fehlerbehandlung
}
```

**Kein `throw`** aus Server Actions – immer strukturierte Rückgabe.

---

## TypeScript-Regeln

- **Kein `any`** – lieber `unknown` mit expliziter Prüfung
- **Keine komplexen Generics** – keine Conditional Types, keine Mapped Types
- **Explizite Rückgabetypen** bei allen Funktionen ausserhalb von Komponenten:

```typescript
// RICHTIG
async function getLeague(id: string): Promise<League | null> { ... }

// FALSCH
async function getLeague(id: string) { ... }
```

- **Prisma-Typen direkt nutzen** aus `@/generated/prisma/client` – nicht neu definieren

---

## Zod v4

Zod v4 hat breaking changes gegenüber v3:

```typescript
// RICHTIG (v4)
z.number({ message: "Muss eine Zahl sein" })

// FALSCH (v3-Syntax, funktioniert nicht mehr)
z.number({ invalid_type_error: "Muss eine Zahl sein" })
```

`z.enum()` erwartet `as const`:

```typescript
z.enum(["WHOLE", "DECIMAL"] as const)
```

---

## React 19 useActionState

Server Actions für `useActionState` brauchen zwingend `prevState` als ersten Parameter:

```typescript
// RICHTIG
export async function createLeague(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult>

// FALSCH – funktioniert nicht mit useActionState
export async function createLeague(formData: FormData): Promise<ActionResult>
```

---

## Dateistruktur einer Komponente

```typescript
// 1. Imports (externe Pakete zuerst, dann interne)
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { createMatch } from "@/lib/matches/actions"

// 2. Typdefinitionen (nur was diese Datei braucht)
interface Props {
  leagueId: string
}

// 3. Komponente
export function MatchForm({ leagueId }: Props) {
  // 3a. Hooks
  // 3b. Event-Handler / lokale Funktionen
  // 3c. JSX
}
```

---

## Server Actions

Jede Server Action liegt in `actions.ts` im zugehörigen Feature-Ordner.
Aufbau immer: **Auth → Validierung → DB**

```typescript
// src/lib/matches/actions.ts
"use server"

import { z } from "zod"
import { db } from "@/lib/db"
import { getAuthSession } from "@/lib/auth-helpers"

const CreateMatchResultSchema = z.object({
  matchId: z.string().min(1, "Paarung ist erforderlich"),
  totalRings: z.number({ message: "Gesamtringe erforderlich" }),
  bestTeiler: z.number({ message: "Bester Teiler erforderlich" }),
})

export async function createMatchResult(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  // Schritt 1: Auth – ohne gültige Session kein DB-Zugriff
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet" }

  // Schritt 2: Validierung
  const parsed = CreateMatchResultSchema.safeParse({
    matchId: formData.get("matchId"),
    totalRings: Number(formData.get("totalRings")),
    bestTeiler: Number(formData.get("bestTeiler")),
  })
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  // Schritt 3: DB – immer mit userId filtern
  const result = await db.matchResult.create({
    data: { ...parsed.data, userId: session.user.id },
  })

  return { data: result }
}
```

---

## Datenbankzugriffe

- **Immer `userId` filtern**: Jede `findMany`, `findFirst`, `update`, `delete` enthält `where: { userId: session.user.id }`
- **Kein direkter Prisma-Aufruf in Komponenten** – nur in `lib/*/` oder Server Actions
- **Keine rohen SQL-Queries** ausser für komplexe Statistiken, dann mit Kommentar

```typescript
// RICHTIG
const matches = await db.match.findMany({
  where: {
    userId: session.user.id, // Datenisolation
    leagueId,
  },
  orderBy: { createdAt: "desc" },
})

// FALSCH – kein userId-Filter
const matches = await db.match.findMany()
```

---

## Kommentare

Kommentare erklären **Warum**, nicht Was.

```typescript
// RICHTIG – erklärt die Absicht
// Niedrigerer Ringteiler gewinnt: MaxRinge - Ringe + Teiler
// Ein Schütze näher an der Mitte (kleinerer Teiler) erhält einen kleineren Wert
const ringteiler = maxRings - totalRings + bestTeiler

// FALSCH – beschreibt nur was der Code zeigt
// Berechnet Ringteiler
const ringteiler = maxRings - totalRings + bestTeiler
```

**Kommentare sind Pflicht bei:**

- Auth-Checks und `userId`-Filtern
- Nicht-offensichtlicher Geschäftslogik (Ringteiler-Berechnung, Rückzug-Logik, Playoff-Seeding)
- Workarounds oder bewussten Vereinfachungen (`// TODO: ...` mit Begründung)
- Jeder Funktion in `lib/` die nicht trivial ist (JSDoc):

```typescript
/**
 * Berechnet den Ringteiler einer Serie.
 * Formel: MaxRinge − Gesamtringe + bester Teiler
 * Niedrigerer Wert = besseres Ergebnis.
 */
function calculateRingteiler(totalRings: number, bestTeiler: number, maxRings: number): number { ... }
```

---

## Fehlerbehandlung

- **Kein `throw` aus Server Actions** – strukturierte Rückgaben
- **Keine leeren catch-Blöcke** – immer loggen und/oder weitergeben
- **Nutzer-Feedback** bei jeder Aktion (Erfolg oder konkreter Fehler)

```typescript
// RICHTIG
export async function withdrawParticipant(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    await db.leagueParticipant.update({ ... })
    return { success: true }
  } catch (error) {
    // Fehler loggen, aber keinen Stack-Trace an den Nutzer geben
    console.error("Fehler beim Rückzug:", error)
    return { error: "Rückzug konnte nicht gespeichert werden." }
  }
}

// FALSCH
try { ... } catch (e) {}
```

---

## Testing

### Framework

- **Vitest** – Testdateien neben dem zu testenden Code: `calculateRingteiler.test.ts` neben `calculateRingteiler.ts`

### Was wird getestet (Pflicht)

1. **Berechnungslogik** – jede Funktion die Werte ausrechnet:
   - Ringteiler-Berechnung
   - Tabellenberechnung (Punkte, direkter Vergleich, bestes Ergebnis)
   - Playoff-Seeding und Bracket-Paarungen
   - Validierung von Schusswerten (min/max je nach Disziplin)

2. **Geschäftsregeln mit Sonderfällen**:
   - Rückzug: alle Ergebnisse werden gestrichen, Tabelle neu berechnet
   - Freilos bei ungerader Teilnehmerzahl
   - Archivierte Disziplin / Liga nicht in Auswahllisten

3. **Zugangskontrolle** (wo testbar):
   - Funktion gibt `null` zurück wenn `userId` nicht passt

4. **Server Action Orchestrierung**:
   - Auth-Guards, Fehlerpfade, erwartete Fehlermeldungen

### Was wird nicht getestet

- React-Komponenten auf reiner Presentational-Ebene
- Next.js Routing und Middleware
- Volle Prisma-Integrationspfade ohne dedizierte Test-DB

### Teststruktur (Arrange–Act–Assert)

```typescript
describe("calculateRingteiler", () => {
  it("berechnet Ringteiler korrekt für Ganzring-Disziplin", () => {
    // Arrange
    const totalRings = 88
    const bestTeiler = 25.7
    const maxRings = 100
    // Act
    const result = calculateRingteiler(totalRings, bestTeiler, maxRings)
    // Assert
    expect(result).toBe(37.7)
  })

  it("niedrigerer Ringteiler gewinnt", () => {
    expect(calculateRingteiler(96, 3.7, 100)).toBeLessThan(calculateRingteiler(96, 4.2, 100))
  })
})
```

### Testabdeckung

- Kein Prozentziel – Tests sollen sinnvoll sein, nicht vollständig
- Faustregel: jede Funktion in `lib/` mit Berechnung oder Entscheidungslogik bekommt Tests
- Tests müssen **vor dem Commit grün sein**

---

## Datum & Zeitzone

**Regel:** `toLocaleDateString()` ohne explizite Zeitzone ist verboten. Im Docker-Container läuft der Server in UTC — ohne Zeitzone-Angabe würden Daten in der Anzeige um eine Stunde verschoben sein.

**Korrekt: `formatDateOnly` aus `src/lib/dateTime.ts` verwenden**

```typescript
import { getDisplayTimeZone, formatDateOnly } from "@/lib/dateTime"

// In einer Server Component (einmalig laden):
const tz = getDisplayTimeZone()

// Datum formatieren:
formatDateOnly(league.firstLegDeadline, tz) // → "31.12.2026"

// Null-safe:
function formatDate(date: Date | null, tz: string): string {
  if (!date) return "—"
  return formatDateOnly(date, tz)
}
```

**Verboten:**

```typescript
// FALSCH — nutzt Server-Zeitzone (UTC in Docker)
date.toLocaleDateString("de-CH")

// FALSCH — auch ohne Locale
date.toLocaleDateString()
```

**`dateTime.ts` ist `server-only`** – kein Import in Client Components. Datum-Formatierung für den Client muss als String von der Server Component übergeben werden.

---

## Häufige Fallstricke

### Prisma 7: Client-Import-Pfad

```typescript
// RICHTIG (Prisma 7 — generierter Client)
import { PrismaClient } from "@/generated/prisma/client"

// FALSCH (Prisma < 7)
import { PrismaClient } from "@prisma/client"
```

### Prisma 7: Decimal-Felder erfordern `.toNumber()` für Arithmetik

```typescript
// RICHTIG
const ringteilerNum = result.ringteiler.toNumber()
const diff = ringteilerA.toNumber() - ringteilerB.toNumber()

// FALSCH — Decimal ist kein primitiver Typ
const diff = result.ringteiler - other.ringteiler // TypeError
```

### Root Layout: `export const dynamic = "force-dynamic"`

Ohne diesen Export versucht Next.js das Root-Layout statisch zu prerendern — schlägt fehl weil die DB im Build nicht verfügbar ist.

```typescript
// PFLICHT in src/app/layout.tsx
export const dynamic = "force-dynamic"
```

### Next.js 16: `proxy.ts` statt `middleware.ts`

In Next.js 16 heisst die Middleware-Konventionsdatei `src/proxy.ts` (nicht `src/middleware.ts`).
Route-Handler bleiben `route.ts` — das ist eine andere Konvention.

### Server Action ohne `prevState` schlägt fehl mit `useActionState`

```typescript
// RICHTIG — useActionState erwartet prevState als ersten Parameter
export async function createLeague(
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult>

// FALSCH — funktioniert nicht mit useActionState
export async function createLeague(formData: FormData): Promise<ActionResult>
```

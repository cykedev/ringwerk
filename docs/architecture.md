# Architektur – 1-gegen-1 Liga-App

Verbindlich gleichrangig mit `docs/technical.md`. Neue Dateien immer gemäss dieser Struktur anlegen.

## Index

- [Routen](#routen)
- [Verzeichnisstruktur](#verzeichnisstruktur)
- [Auth-Strategie](#auth-strategie)
- [Lib-Module](#lib-module)
- [Datenflussprinzip](#datenflussprinzip)

---

## Routen

```
/login                          ← öffentlich
/                               ← Dashboard (Übersicht aktiver Ligen)
/leagues                        ← alle Ligen
/leagues/new                    ← Liga anlegen (Admin)
/leagues/[id]                   ← Liga-Detailseite (geplant: Tabelle)
/leagues/[id]/participants      ← Teilnehmer einschreiben/verwalten (Admin)
/leagues/[id]/schedule          ← Spielplan generieren + anzeigen (Admin)
/leagues/[id]/matches/[matchId] ← Paarung + Ergebnis erfassen (geplant)
/leagues/[id]/playoffs          ← Playoff-Bracket (geplant)
/leagues/[id]/playoffs/[matchId]← Playoff-Duell + Ergebnis (geplant)
/participants                   ← Teilnehmerverwaltung
/participants/new               ← Teilnehmer anlegen (Admin)
/participants/[id]              ← Profil: alle Duelle, Ergebnisse, Statistik
/disciplines                    ← Disziplinverwaltung (Admin)
/disciplines/new                ← Disziplin anlegen (Admin)
/disciplines/[id]               ← Disziplin bearbeiten (Admin)
/admin/users                    ← Nutzerverwaltung (nur Admin)
/admin/users/new                ← Nutzer anlegen (nur Admin)
/admin/users/[id]               ← Nutzer bearbeiten (nur Admin)
/account                        ← Passwort ändern (eingeloggt)
/api/auth/[...nextauth]         ← NextAuth-Handler
```

---

## Verzeichnisstruktur

```
src/
  app/
    (public)/
      login/
        page.tsx
    (app)/
      layout.tsx              ← Auth-Guard + Navigation
      page.tsx                ← Dashboard
      leagues/
        page.tsx
        new/
          page.tsx
        [id]/
          page.tsx
          participants/
            page.tsx
          schedule/
            page.tsx
          matches/
            [matchId]/
              page.tsx        ← geplant
          playoffs/
            page.tsx          ← geplant
            [matchId]/
              page.tsx        ← geplant
      participants/
        page.tsx
        new/
          page.tsx
        [id]/
          page.tsx
      disciplines/
        page.tsx
        new/
          page.tsx
        [id]/
          page.tsx
      admin/
        layout.tsx            ← Admin-Rolle erzwingen
        users/
          page.tsx
          new/
            page.tsx
          [id]/
            page.tsx
      account/
        page.tsx
    api/
      auth/
        [...nextauth]/
          route.ts
  components/
    ui/                       ← shadcn/ui (auto-generiert, nicht manuell editieren)
    app/
      leagues/                ← Liga-spezifische Komponenten
      leagueParticipants/     ← Einschreiben + Rückzug
      matchups/               ← Spielplan-Generierung + Anzeige
      participants/
      disciplines/
      admin/
      shared/                 ← wiederverwendbare App-Komponenten
  lib/
    auth.ts                   ← NextAuth authOptions
    auth-helpers.ts           ← getAuthSession()
    auth-rate-limit/          ← Rate-Limiting-Modul
    authValidation.ts         ← E-Mail/Passwort-Validierung
    db.ts                     ← Prisma-Client Singleton
    startup.ts                ← Erstinitialisierung (Admin + Disziplinen), aufgerufen aus root layout.tsx
    utils.ts                  ← cn() und andere UI-Helfer
    types.ts                  ← Shared Types (ActionResult etc.)
    leagues/
      actions.ts              ← Server Actions: Liga anlegen/bearbeiten/abschliessen
      queries.ts              ← Datenbankabfragen: Liga laden, Tabelle
      calculateTable.ts       ← Tabellenberechnung (Punkte, Direktvergleich, RT)
      types.ts
    leagueParticipants/
      actions.ts              ← Einschreiben, Rückzug, Rückzug rückgängig
      queries.ts
      types.ts
    matchups/
      actions.ts              ← Spielplan generieren (Round-Robin)
      queries.ts              ← Paarungen laden, Schedule-Status
      generateSchedule.ts     ← Circle-Method-Algorithmus (testpflichtig)
      generateSchedule.test.ts
      types.ts
    participants/
      actions.ts              ← Teilnehmer anlegen/bearbeiten
      queries.ts
      types.ts
    disciplines/
      actions.ts
      queries.ts
      systemDisciplines.ts    ← LP, LG, LPA, LGA Seed-Daten
      types.ts
    users/
      actions.ts              ← Nutzer anlegen, bearbeiten, Passwort-Reset
      queries.ts
      types.ts
  types/
    next-auth.d.ts            ← NextAuth Module Augmentation
  generated/
    prisma/                   ← auto-generiert via `prisma generate` — nie manuell editieren
```

---

## Auth-Strategie

**Next.js 16 verwendet `proxy.ts` statt `middleware.ts`** – die Datei-Konvention wurde umbenannt.
treffsicher (und damit auch diese App) nutzt **beide Schichten**:

1. **`src/proxy.ts`** – Edge-Level-Schutz via `withAuth` (next-auth); leitet nicht-eingeloggte Nutzer früh um
2. **Layout-basierte Guards** – zweite Absicherungsschicht, prüft Session zusätzlich im Layout

### `src/proxy.ts` – Edge-Auth (Next.js 16 Konvention)

```typescript
export const proxy = withAuth({
  pages: { signIn: "/login" },
  callbacks: {
    authorized: ({ req, token }) => {
      if (!token) return false
      if (req.nextUrl.pathname.startsWith("/admin")) return token.role === "ADMIN"
      return true
    },
  },
})
export default proxy

export const config = {
  matcher: ["/leagues/:path*", "/participants/:path*" /* ... */],
}
```

### Root Layout (`src/app/layout.tsx`)

- `export const dynamic = "force-dynamic"` – verhindert statisches Prerendering (Build ohne Live-DB möglich)
- Ruft `runStartup()` auf: legt Admin + Standard-Disziplinen beim ersten Start an (idempotent via `hasRun`-Flag)

### Route Groups

| Group         | Layout                                    | Schutz               |
| ------------- | ----------------------------------------- | -------------------- |
| `(public)`    | kein Auth-Check                           | Login-Seite          |
| `(app)`       | `getAuthSession()` → `redirect("/login")` | alle normalen Seiten |
| `(app)/admin` | zusätzlich Rollen-Check                   | nur ADMIN            |

### `(app)/layout.tsx` – Auth-Guard

```typescript
const session = await getAuthSession()
if (!session) redirect("/login")
```

### `(app)/admin/layout.tsx` – Rollen-Guard

```typescript
const session = await getAuthSession()
if (!session) redirect("/login")
if (session.user.role !== "ADMIN") redirect("/")
```

### In Server Actions

Immer in dieser Reihenfolge: **Auth → Rolle prüfen (falls nötig) → Validierung → DB**

```typescript
const session = await getAuthSession()
if (!session) return { error: "Nicht angemeldet" }
if (session.user.role !== "ADMIN") return { error: "Keine Berechtigung" }
```

### `src/lib/startup.ts` – Erstinitialisierung

Wird vom Root-Layout bei jedem Request aufgerufen, führt aber nur einmal pro Prozess etwas aus:

1. Standard-Disziplinen anlegen (LP, LG, LPA, LGA) – falls noch nicht vorhanden
2. Admin-Account anlegen aus `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` – falls kein Admin existiert

---

## Lib-Module

Jedes Feature-Modul (`lib/<feature>/`) folgt diesem Muster:

| Datei           | Inhalt                                                |
| --------------- | ----------------------------------------------------- |
| `actions.ts`    | Server Actions (Auth → Validierung → DB)              |
| `queries.ts`    | Reine DB-Lesefunktionen (kein userId-Filter)          |
| `types.ts`      | Feature-spezifische TypeScript-Typen                  |
| `calculate*.ts` | Reine Berechnungsfunktionen (keine DB, testpflichtig) |

**Grössenregel:** Datei > 200 Zeilen → splitten in `actions/` oder `queries/` Unterordner mit Barrel-Export.

---

## Datenflussprinzip

```
Browser-Formular
  → useActionState(serverAction, null)
    → Server Action (lib/<feature>/actions.ts)
      → getAuthSession()          Auth
      → ZodSchema.safeParse()     Validierung
      → db.<model>.<op>()         DB (immer mit userId-Filter)
      → revalidatePath()          Cache invalidieren
      → return ActionResult       Strukturierte Rückgabe

Server Component (page.tsx)
  → lib/<feature>/queries.ts      Datenladen
  → Komponente rendern
```

**Kein Datenabruf in Client Components** – nur in Server Components oder via Server Actions.

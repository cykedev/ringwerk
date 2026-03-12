# Reference Files

Local reference implementation: `/Users/christian/repos/treffsicher`

| File                      | Reference for                      |
| ------------------------- | ---------------------------------- |
| `src/lib/auth.ts`         | NextAuth authOptions               |
| `src/lib/db.ts`           | Prisma Client Singleton (Prisma 7) |
| `src/lib/auth-helpers.ts` | getAuthSession()                   |
| `src/proxy.ts`            | Edge-Auth (Next.js 16)             |
| `src/lib/disciplines/`    | Feature module pattern             |
| `prisma/schema.prisma`    | Prisma 7 schema conventions        |

## In-Project Patterns

| Pattern                              | Reference file                                                           |
| ------------------------------------ | ------------------------------------------------------------------------ |
| List with row actions                | `src/components/app/participants/ParticipantRowActions.tsx`              |
| Active/inactive separation           | `src/app/(app)/participants/page.tsx`                                    |
| Table container                      | `src/components/app/matchups/ScheduleView.tsx`                           |
| Server Action with auth + validation | `src/lib/leagues/actions.ts`                                             |
| Actions test file                    | `/Users/christian/repos/treffsicher/src/lib/disciplines/actions.test.ts` |

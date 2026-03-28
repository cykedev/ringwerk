Run all quality gates and report the result.

Runner: `docker compose -f docker-compose.dev.yml run --rm app`

Gates (run ALL, even if one fails):

1. `npm run lint`
2. `npm run format:check`
3. `npm run test`
4. `npx tsc --noEmit`

Report concisely: which gates are green, which are red, and if red: the relevant error messages. Suggest concrete fixes if the cause is clear.

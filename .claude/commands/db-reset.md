Fully reset the dev database (all data will be lost).

Only use in the local development environment — never in production.

1. Read `.claude/pipeline.json` to get `quality.runner` and `schema.seedCommand`
2. Stop and remove containers with volumes (appropriate for the project's container setup)
3. Start the database service
4. Wait until the database is ready
5. Run migrations
6. Run the seed command: `<runner> <seedCommand>`
7. Start the application (or use `preview_start` via launch.json)

Confirm: login with the seed admin account works.

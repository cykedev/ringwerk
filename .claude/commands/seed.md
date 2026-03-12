Run the database seed manually (only needed after `/db-reset`).

1. Read `.claude/pipeline.json` to get `quality.runner` and `schema.seedCommand`
2. Run: `<runner> <seedCommand>`

After running, confirm:

- Was the seed data created (or was it already present)?
- If errors: output the full error message

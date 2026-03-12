Create a new schema migration.

1. Read `.claude/pipeline.json` to get `quality.runner` and `schema.migrateDevCommand`
2. Use the first argument token as migration name (kebab-case, English, descriptive). If no name was given, ask before proceeding.
3. Run: `<runner> <migrateDevCommand> --name <name>`

After running:

- Confirm the migration file was created in the migrations directory
- Remind that the migration file must be committed
- Check that the generated client was updated
- Reminder: no destructive migrations without a comment in the SQL file

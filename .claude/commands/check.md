Run all quality gates and report the result.

1. Read `.claude/pipeline.json` to get `quality.runner` and `quality.gates`
2. For each gate in the configured order, run: `<runner> <gate.command>`
3. Run ALL gates even if one fails

Report concisely: which gates are green, which are red, and if red: the relevant error messages. Suggest concrete fixes if the cause is clear.

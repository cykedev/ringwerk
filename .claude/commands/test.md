Run only the test suite (no lint, format check, or type check).

1. Read `.claude/pipeline.json` to get `quality.runner` and `quality.testOnly`
2. Run: `<runner> <testOnly>`

Report:

- How many tests pass / fail?
- If failures: full error message with file name and line
- Do not suggest code changes until the root cause is clear

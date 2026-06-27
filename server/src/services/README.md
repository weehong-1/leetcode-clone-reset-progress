# services

Core business logic:

- `leetcode.service.ts` — LeetCode proxy: `getProblem(slug)` (public GraphQL),
  `runCode` (interpret_solution) and `submitCode` (submit) via authenticated
  REST, plus the judge polling worker (1.5s interval until the state leaves
  `PENDING`/`STARTED`). Exports `LeetCodeError` and `hasLeetCodeAuth`.
- `progress.service.ts` — SM-2 spaced-repetition scheduling _(planned)_.
- `ai.service.ts` — complexity validation and the interviewer/tutor prompt _(planned)_.

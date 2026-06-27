# models

Mongoose schemas.

- `progress.model.ts` — `Progress`: per-problem SM-2 spaced-repetition state
  (`repetition`, `efactor`, `interval`, `nextReviewDate`, last-attempt snapshot).
  One document per actively-reviewed problem; mutated after each graded
  submission and cleared by the "soft reset".
- `submission.model.ts` — `Submission`: immutable log of each "Submit" attempt
  (judge result, performance timing/grade, complexity self-assessment + AI
  feedback). Preserved across resets as history.
- `index.ts` — barrel re-exporting both models and their document interfaces.

Domain unions (`Difficulty`, `Sm2Grade`) live in `@shared` and are imported
type-only.

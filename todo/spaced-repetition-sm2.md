# Spaced Repetition (SM-2) — Implementation TODO

Status: **not implemented** — only the `Progress` Mongoose model (SM-2 fields)
exists today and is wired up nowhere. This list tracks building the full feature
(ARCHITECTURE.md Feature 5).

Benchmarks: **Easy 15m / Medium 30m / Hard 45m**.
Grades: `≤ benchmark → 5`, `+33% → 4`, `+66% → 3`, slower → `2`, code errors → `0`.

## Backend (sequential)

- [ ] **29 — Define SM-2 shared contracts** _(shared/)_
  - Difficulty benchmarks + grade-mapping constants.
  - DTOs: `ProgressDTO` (slug, repetition, efactor, interval, nextReviewDate, lastGrade), `ReviewItem` for the due list.
  - Reuse existing `Sm2Grade` / `Difficulty`.
  - **Decision to lock:** where the grade is computed — frontend (per architecture) vs a shared `gradeFromElapsed` helper. _Recommended: shared pure helper so the backend can validate it too._

- [ ] **30 — Backend SM-2 algorithm service** _(blocked by 29)_
  - `server/src/services/sm2.service.ts`: pure `computeSm2(grade, {repetition, efactor, interval}) → {repetition, efactor, interval, nextReviewDate}` (efactor floor 1.3; grade < 3 resets repetition/interval).
  - `gradeFromElapsed(elapsedSeconds, difficulty, hadError)`.
  - No DB; unit-testable.

- [ ] **31 — Progress persistence service** _(blocked by 30)_
  - `server/src/services/progress.service.ts` using `ProgressModel`:
    - `recordAttempt(slug, grade, problemMeta, durationSeconds)` → run SM-2, upsert `Progress`, set `lastGrade` / `lastReviewedAt`.
    - `getDueReviews(now)` sorted by `nextReviewDate`.
    - `softReset()` — zero algorithmic state (repetition/efactor/interval/nextReviewDate) while preserving `Submission` history.

- [ ] **32 — Progress API: controller + routes** _(blocked by 31)_
  - `progress.controller.ts` (zod) + `progress.routes.ts`:
    - `POST /api/progress/:slug` — record graded attempt.
    - `GET /api/progress/reviews` — due list.
    - `GET /api/progress/:slug` — current state.
    - `POST /api/progress/reset` — soft reset.
  - `ApiResponse` envelope + error mapping; mount `/api/progress` in `app.ts`.

## Frontend

- [ ] **33 — Grade + save progress on Accepted**
  - Compute SM-2 grade from stopwatch elapsed vs benchmark (errors → 0).
  - On an Accepted submit → `POST /api/progress/:slug` with grade + duration; show the resulting next-review date in the results panel.
  - Add api fn + `useSaveProgressMutation` in `features/workspace`.

- [ ] **34 — Review dashboard + soft reset**
  - `/review` route listing due problems (`GET /api/progress/reviews`) with next-review dates + links into the workspace.
  - "Reset progress" control → `POST /api/progress/reset` (with confirm). Link from Home.

## Verify

- [ ] **35 — Verify end-to-end**
  - `npm run verify` + `npm run lint` → exit 0.
  - Live Mongo test: record attempts at various grades, assert SM-2 math (interval/efactor/nextReviewDate progression), due-review query, and that soft reset zeros state while `Submission` history remains. Clean up test data.

---

_Mirrors tracked tasks #29–#35. Suggest a short plan before starting (spans backend + frontend)._

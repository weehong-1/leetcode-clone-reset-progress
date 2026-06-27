# LeetTrace - System Architecture & Plan

## Context & Vision
LeetCode deprecated its "Sessions" feature, preventing developers from resetting their overall progress for spaced-repetition and interview prep. This application builds a completely local workspace that fetches problems, tests code, submits it to a real LeetCode account, and automates spaced-repetition scheduling (SM-2) entirely locally.

---

## Tech Stack & Configuration
- **Frontend Framework:** React 19 + Vite + TypeScript (with TanStack Router & TanStack Query)
- **Styling:** Tailwind CSS
- **Code Editor:** `@monaco-editor/react` (v4.7.0-rc.0 or higher for React 19 compatibility)
- **Backend Runtime:** Node.js + Express + TypeScript (executed via `tsx`)
- **Database:** MongoDB via Mongoose
- **AI Engine:** OpenRouter or DeepSeek API via the `openai` Node SDK

---

## Project Directory Layout
The project follows a unified root structure based on the provided `package.json` configuration:
```text
/
├── package.json          # Core dependencies for frontend, backend, and scripts
├── vite.config.ts        # Frontend bundler configuration
├── src/                  # FRONTEND: React application codebase
│   ├── routes/           # TanStack router tree
│   ├── components/       # Workspace UI components (Timer, Editor, Tabs)
│   └── services/         # Frontend API communication layer (api.ts)
├── server/               # BACKEND: Express.js application layer
│   ├── src/
│   │   ├── config/       # db.ts (Mongoose connector), dotenv handling
│   │   ├── models/       # Mongoose schemas (Progress, Submission)
│   │   ├── routes/       # Express route controllers
│   │   ├── controllers/  # Request validation and handling
│   │   └── services/     # Core logic (leetcode, progress/SM-2, ai)
│   └── server.ts         # Backend entry point called by `npm run server`
```

---

## System Core Features

### 1. LeetCode Proxy (GraphQL & Asynchronous REST)
- **GraphQL:** The backend proxies requests to `https://leetcode.com/graphql` to pull descriptions, code stubs, and problem metadata.
- **REST Cookie Authentication:** Uses `LEETCODE_SESSION` and `csrftoken` environment variables to spoof authenticated requests.
- **Asynchronous Execution Triggers:**
  - **"Run Code":** POSTs to `https://leetcode.com/problems/{slug}/interpret_solution/` (runs example test cases).
  - **"Submit Code":** POSTs to `https://leetcode.com/problems/{slug}/submit/` (runs all test cases).
- **Polling Worker:** Both endpoints respond immediately with a `submission_id`. The backend `leetcode.service.ts` must poll `GET https://leetcode.com/submissions/detail/{submission_id}/check/` every 1.5 seconds until status is no longer `PENDING` or `STARTED`.

### 2. Editor Lock & Prep Phase
- Upon loading a problem, the Monaco Editor option is instantiated with `readOnly: true`. Run and Submit buttons are visually and logically disabled.
- A prominent **"Start Challenge"** overlay is displayed.
- Clicking "Start Challenge" unlocks the editor (`readOnly: false`), hides the configuration tools, and starts the performance stopwatch.

### 3. Preferences & Workspace Settings
- Provide a dropdown menu in the header altering editor properties dynamically. 
- Supported fonts loaded via Google Fonts: *Fira Code, JetBrains Mono, Source Code Pro, Roboto Mono, Inconsolata*.
- Editor must be configured to utilize local TypeScript web workers to enforce native, instant syntax highlighting and compile checks.

### 4. Post-Submission Complexity Validation
- Once a submission loop yields `"status_msg": "Accepted"`, pause completion actions and present an overlay modal.
- Prompt the user to provide their estimated **Time Complexity** and **Space Complexity**.
- Provide a "Skip / I don't know" action.
- Payload is evaluated by the backend AI service (`/api/ai/validate-complexity`). The AI will analyze the successful code string against the user's guesses and explain the actual Big-O bounds.

### 5. Automated Performance Scoring & Spaced Repetition (SM-2)
- Frontend monitors elapsed duration down to the second.
- Once the complexity check completes, the system automatically determines the SM-2 Grade (0-5) mapping based on target benchmarks:
  - **Benchmarks:** Easy = 15m, Medium = 30m, Hard = 45m.
  - **Grades:** $\le$ Benchmark = `5`; $+33\%$ over = `4`; $+66\%$ over = `3`; Slower = `2`; Code errors = `0`.
- The database fields `repetition`, `efactor` (default 2.5), `interval`, and `next_review_date` are mathematically calculated and written back into the problem's MongoDB document.
- **Soft Reset:** A reset route wipes the algorithmic review states of active profiles, moving active review entries back to zero while maintaining historical logs.

### 6. AI Interviewer and Tutor Prompt Bounds
- The AI context pane must initialize conversations passing the following instruction structure natively along with the active problem text payload:
  ```text
  I want to discuss a LeetCode problem. Act as my technical interviewer and LeetCode tutor.
  Strict rules:
  1. Do NOT give me the final code, answer, or direct hints unless explicitly asked.
  2. Explain problems using simple real-world analogies, but leave the solution design to me.
  3. Validate suggested patterns (DP, Greedy, BFS) or gently point out flaws (e.g., complexity issues).
  4. When requested, provide clean, commented Java code, complexity data, and structural mental boilderplate.
  5. Verify against optimal community implementations.
  ```

---

## Execution Directives for Claude Code
1. **Pacing:** Proceed strictly step-by-step through the layout. Ask for explicit verification between the backend initialization, Mongoose schema creation, and UI generation phases.
2. **Error Safety:** Run execution test compilation queries before concluding structural tasks. Ensure type-safety maps correctly across the TanStack layout patterns already present in the boilerplate.

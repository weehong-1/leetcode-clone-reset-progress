/**
 * Problem + spaced-repetition domain primitives shared by the client and
 * server. Type-only (no runtime values) — see shared/README.md.
 */

/** LeetCode problem difficulty. Drives the SM-2 time benchmarks. */
export type Difficulty = "Easy" | "Medium" | "Hard";

/**
 * SM-2 recall grade. The frontend derives this from solve time vs. the
 * difficulty benchmark; the backend feeds it into the SM-2 scheduler.
 * 0 = blackout/error, 5 = perfect recall.
 */
export type Sm2Grade = 0 | 1 | 2 | 3 | 4 | 5;

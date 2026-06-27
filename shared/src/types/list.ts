/**
 * Contracts for problem lists, shared between client and server.
 *
 * Two kinds share one shape:
 *  - "curated" — built-in, read-only sets (Blind 75, Grind 75, Top Interview
 *    150, Top 100 Liked), backed by hand-maintained JSON.
 *  - "custom"  — user-created, editable lists persisted in MongoDB.
 *
 * Problems themselves are still fetched live from LeetCode; a list only stores
 * light metadata. Solved status is derived server-side from accepted
 * submissions. Type-only (see shared/README.md).
 */
import type { Difficulty } from "./problem";

/** Distinguishes built-in lists from user-created ones. */
export type ListKind = "curated" | "custom";

/** Per-difficulty problem counts within a list. */
export interface DifficultyCounts {
	Easy: number;
	Medium: number;
	Hard: number;
}

/** One problem row inside a list, with the user's solved state. */
export interface ProblemListItem {
	/** LeetCode frontend id, e.g. "1". */
	frontendId: string;
	title: string;
	titleSlug: string;
	difficulty: Difficulty;
	/** True when the user has an accepted submission for this slug. */
	solved: boolean;
}

/** Headline metadata for one list (no per-problem rows). */
export interface ProblemListSummary {
	/** Stable id: a known slug for curated lists, a generated id for custom. */
	id: string;
	kind: ListKind;
	name: string;
	description: string;
	/** Canonical source URL for curated lists; empty for custom lists. */
	sourceUrl: string;
	/** Total problems in the list. */
	total: number;
	/** How many of those the user has solved. */
	solvedCount: number;
	difficultyCounts: DifficultyCounts;
}

/** A list summary plus its ordered problem rows. */
export interface ProblemListDetail extends ProblemListSummary {
	items: Array<ProblemListItem>;
}

/** Request body for `POST /api/lists` (create a custom list). */
export interface CreateListBody {
	name: string;
}

/** Request body for `PATCH /api/lists/:id` (rename a custom list). */
export interface RenameListBody {
	name: string;
}

/** Request body for `POST /api/lists/:id/problems` (add a problem). */
export interface AddProblemBody {
	/** A LeetCode problem slug or URL — the server normalizes it. */
	slug: string;
}

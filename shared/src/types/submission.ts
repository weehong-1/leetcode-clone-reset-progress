/**
 * Contracts for the submission history, shared between client and server.
 * Type-only (see shared/README.md).
 */

/** Whether a history entry came from a judged Submit or a manual Snapshot. */
export type SubmissionSource = "submit" | "snapshot";

/** One persisted history entry, as returned by `/api/submissions`. */
export interface Submission {
	/** Mongo document id — the canonical handle for PATCH/DELETE. */
	id: string;
	titleSlug: string;
	/** LeetCode submission id; null for snapshots. */
	submissionId: string | null;
	source: SubmissionSource;
	lang: string;
	code: string;
	/** User-given label for the approach. */
	name: string | null;
	/** Free-form note / reflection. */
	note: string | null;

	/** Judge verdict; null for snapshots. */
	statusMsg: string | null;
	accepted: boolean;
	runtimeMs: number | null;
	memoryKb: number | null;
	totalCorrect: number | null;
	totalTestcases: number | null;

	/** ISO timestamps. */
	createdAt: string;
	updatedAt: string;
}

/** Body for `POST /api/submissions` (manual snapshot of the current editor). */
export interface CreateSnapshotBody {
	slug: string;
	lang: string;
	code: string;
	name?: string;
	note?: string;
}

/** Body for `PATCH /api/submissions/:id` (edit name/note). */
export interface UpdateSubmissionBody {
	name?: string;
	note?: string;
}

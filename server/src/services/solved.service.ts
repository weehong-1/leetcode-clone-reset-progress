import mongoose from "mongoose";
import type { DifficultyCounts, ProblemListItem } from "@shared";
import { ProgressResetModel } from "../models/progressReset.model";
import { SubmissionModel } from "../models/submission.model";

/** A problem's static metadata (no solved flag yet). */
export type ProblemMeta = Omit<ProblemListItem, "solved">;

/** Mongoose `readyState === 1` means a live, connected database. */
export function isDatabaseConnected(): boolean {
	return mongoose.connection.readyState === 1;
}

/**
 * Slugs the user has solved. A problem is solved when it has an accepted
 * submission newer than any "reset cutoff" recorded for it (see
 * {@link IProgressReset}) — so a progress reset un-solves a problem without
 * deleting its history, and re-solving it later marks it solved again.
 *
 * Wrapped so a down or empty database degrades to "nothing solved" instead of
 * a 500. Shared by the curated and custom list services.
 */
export async function getSolvedSlugs(): Promise<Set<string>> {
	// Skip the query entirely when disconnected, otherwise Mongoose buffers it
	// for ~10s before failing — curated lists would hang on their solved counts.
	if (!isDatabaseConnected()) return new Set<string>();
	try {
		const [accepted, resets] = await Promise.all([
			// Latest accepted submission per problem.
			SubmissionModel.aggregate<{ _id: string; lastAt: Date }>([
				{ $match: { accepted: true } },
				{ $group: { _id: "$titleSlug", lastAt: { $max: "$createdAt" } } },
			]),
			ProgressResetModel.find()
				.select("titleSlug resetAt")
				.lean<Array<{ titleSlug: string; resetAt: Date }>>(),
		]);

		const resetAt = new Map(resets.map((row) => [row.titleSlug, row.resetAt]));
		const solved = new Set<string>();
		for (const row of accepted) {
			const cutoff = resetAt.get(row._id);
			// Solved if never reset, or accepted again after the reset cutoff.
			if (!cutoff || row.lastAt > cutoff) solved.add(row._id);
		}
		return solved;
	} catch (error) {
		console.error("Failed to load solved slugs (treating as none):", error);
		return new Set<string>();
	}
}

/** Count solved problems in a slug list against the solved set. */
export function countSolved(
	slugs: Array<string>,
	solved: Set<string>
): number {
	return slugs.reduce((total, slug) => total + (solved.has(slug) ? 1 : 0), 0);
}

/** Tally per-difficulty counts over a set of problems. */
export function difficultyCounts(
	problems: Array<ProblemMeta>
): DifficultyCounts {
	const counts: DifficultyCounts = { Easy: 0, Medium: 0, Hard: 0 };
	for (const problem of problems) counts[problem.difficulty] += 1;
	return counts;
}

/** Attach the user's solved flag to each problem, preserving order. */
export function withSolved(
	problems: Array<ProblemMeta>,
	solved: Set<string>
): Array<ProblemListItem> {
	return problems.map((problem) => ({
		...problem,
		solved: solved.has(problem.titleSlug),
	}));
}

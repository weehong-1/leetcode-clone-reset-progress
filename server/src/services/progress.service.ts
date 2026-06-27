import type { ResetProgressResult } from "@shared";
import { ProgressResetModel } from "../models/progressReset.model";
import { getCuratedSlugs } from "./curated.service";
import { getCustomSlugs } from "./customList.service";
import { ListError } from "./list.errors";
import { getSolvedSlugs, isDatabaseConnected } from "./solved.service";

/**
 * Reset progress for the "main" problem list: un-solve every currently-solved
 * problem that is NOT part of any saved list (curated or custom). Submission
 * history is preserved — we record a per-slug reset cutoff so the problem only
 * counts as solved again once accepted anew (see {@link getSolvedSlugs}).
 */
export async function resetMainProgress(): Promise<ResetProgressResult> {
	if (!isDatabaseConnected()) {
		throw new ListError("Database unavailable — progress reset needs MongoDB", 503);
	}

	const [curated, custom, solved] = await Promise.all([
		Promise.resolve(getCuratedSlugs()),
		getCustomSlugs(),
		getSolvedSlugs(),
	]);

	const inAnyList = new Set<string>([...curated, ...custom]);
	const toReset = [...solved].filter((slug) => !inAnyList.has(slug));

	if (toReset.length > 0) {
		const resetAt = new Date();
		await ProgressResetModel.bulkWrite(
			toReset.map((titleSlug) => ({
				updateOne: {
					filter: { titleSlug },
					update: { $set: { resetAt } },
					upsert: true,
				},
			}))
		);
	}

	return { resetCount: toReset.length };
}

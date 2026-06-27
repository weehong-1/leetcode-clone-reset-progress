import mongoose from "mongoose";
import type { LeetCodeProblem } from "@shared";
import { type IQuestion, QuestionModel } from "../models/question.model";
import { getProblem } from "./leetcode.service";

/** Strip Mongo internals/timestamps, returning the shared API shape. */
function toDto(doc: IQuestion): LeetCodeProblem {
	return {
		questionId: doc.questionId,
		questionFrontendId: doc.questionFrontendId,
		title: doc.title,
		titleSlug: doc.titleSlug,
		difficulty: doc.difficulty,
		content: doc.content,
		topicTags: doc.topicTags,
		codeSnippets: doc.codeSnippets,
		exampleTestcases: doc.exampleTestcases,
		sampleTestCase: doc.sampleTestCase,
		hints: doc.hints,
	};
}

/** True when Mongoose has a live connection we can read/write. */
function isMongoConnected(): boolean {
	return mongoose.connection.readyState === 1;
}

interface GetCachedProblemOptions {
	/** Force a live re-fetch from LeetCode and overwrite the cached copy. */
	refresh?: boolean;
}

/**
 * Read-through cache for a single question's content.
 *
 *  - Cache hit  → served straight from MongoDB (no LeetCode request).
 *  - Cache miss / `refresh` → fetched live, then upserted (best-effort).
 *  - Mongo down → falls back to a live fetch with no caching, so the feature
 *    degrades gracefully like the rest of the app.
 */
export async function getCachedProblem(
	slug: string,
	{ refresh = false }: GetCachedProblemOptions = {}
): Promise<LeetCodeProblem> {
	if (!isMongoConnected()) {
		return getProblem(slug);
	}

	if (!refresh) {
		const cached = await QuestionModel.findOne({ titleSlug: slug }).lean<IQuestion>().exec();
		if (cached) {
			return toDto(cached);
		}
	}

	const problem = await getProblem(slug);

	// Persist for next time. Best-effort: a write failure must not fail the
	// request, since we already have the live data to return.
	try {
		await QuestionModel.updateOne(
			{ titleSlug: slug },
			{ $set: problem },
			{ upsert: true }
		).exec();
	} catch (error) {
		console.error(`Failed to cache question "${slug}":`, error);
	}

	return problem;
}

import mongoose, { Schema, type Model } from "mongoose";
import type { Difficulty } from "@shared";

/**
 * Cached copy of a LeetCode question's full content. The first time a problem
 * is opened it is fetched live from leetcode.com and stored here; subsequent
 * opens are served straight from MongoDB so the app stops re-hitting LeetCode
 * for already-seen problems. Fields mirror the shared `LeetCodeProblem` shape
 * one-to-one, so a stored document maps directly back to the API response.
 */
export interface IQuestion {
	questionId: string;
	questionFrontendId: string;
	title: string;
	/** Stable LeetCode slug, e.g. "two-sum". Unique cache key. */
	titleSlug: string;
	difficulty: Difficulty;
	/** HTML problem statement. */
	content: string;
	topicTags: string[];
	codeSnippets: { lang: string; langSlug: string; code: string }[];
	exampleTestcases: string;
	sampleTestCase: string;
	hints: string[];

	// --- Mongoose timestamps ---
	createdAt: Date;
	updatedAt: Date;
}

const codeSnippetSchema = new Schema<IQuestion["codeSnippets"][number]>(
	{
		lang: { type: String, required: true },
		langSlug: { type: String, required: true },
		code: { type: String, required: true },
	},
	{ _id: false }
);

const questionSchema = new Schema<IQuestion>(
	{
		questionId: { type: String, required: true, trim: true },
		questionFrontendId: { type: String, required: true, trim: true },
		title: { type: String, required: true, trim: true },
		titleSlug: { type: String, required: true, trim: true },
		difficulty: {
			type: String,
			enum: ["Easy", "Medium", "Hard"],
			required: true,
		},
		content: { type: String, default: "" },
		topicTags: { type: [String], default: [] },
		codeSnippets: { type: [codeSnippetSchema], default: [] },
		exampleTestcases: { type: String, default: "" },
		sampleTestCase: { type: String, default: "" },
		hints: { type: [String], default: [] },
	},
	{ timestamps: true }
);

// One cached document per problem; also the lookup key for cache hits.
questionSchema.index({ titleSlug: 1 }, { unique: true });

const existing = mongoose.models["Question"] as Model<IQuestion> | undefined;

export const QuestionModel: Model<IQuestion> =
	existing ?? mongoose.model<IQuestion>("Question", questionSchema);

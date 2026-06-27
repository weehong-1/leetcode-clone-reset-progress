import mongoose, { Schema, type Model } from "mongoose";
import type { Difficulty } from "@shared";

/**
 * Per-problem spaced-repetition state (SM-2). One document per LeetCode
 * problem the user is actively reviewing. The SM-2 fields are recomputed and
 * written back here after each graded submission; the "soft reset" wipes them
 * back to their defaults while the historical {@link ISubmission} log is kept.
 */
export interface IProgress {
	// --- Problem identity / metadata (from the LeetCode GraphQL proxy) ---
	titleSlug: string;
	questionId: string;
	frontendQuestionId: string | null;
	title: string;
	difficulty: Difficulty;
	topicTags: string[];

	// --- SM-2 scheduling state ---
	/** Number of consecutive successful recalls. */
	repetition: number;
	/** Ease factor (SM-2 "EF"), starts at 2.5, floored at 1.3. */
	efactor: number;
	/** Current inter-repetition interval, in days. */
	interval: number;
	/** When the problem is next due for review (null = not yet scheduled). */
	nextReviewDate: Date | null;

	// --- Last attempt snapshot ---
	/** Most recent SM-2 grade (0–5), null until first review. */
	lastGrade: number | null;
	lastReviewedAt: Date | null;
	/** Elapsed solve time of the last attempt, in seconds. */
	lastDurationSeconds: number | null;

	// --- Mongoose timestamps ---
	createdAt: Date;
	updatedAt: Date;
}

const progressSchema = new Schema<IProgress>(
	{
		titleSlug: { type: String, required: true, unique: true, trim: true },
		questionId: { type: String, required: true, trim: true },
		frontendQuestionId: { type: String, default: null, trim: true },
		title: { type: String, required: true, trim: true },
		difficulty: {
			type: String,
			required: true,
			enum: ["Easy", "Medium", "Hard"],
		},
		topicTags: { type: [String], default: [] },

		repetition: { type: Number, default: 0, min: 0 },
		efactor: { type: Number, default: 2.5, min: 1.3 },
		interval: { type: Number, default: 0, min: 0 },
		nextReviewDate: { type: Date, default: null },

		lastGrade: { type: Number, default: null, min: 0, max: 5 },
		lastReviewedAt: { type: Date, default: null },
		lastDurationSeconds: { type: Number, default: null, min: 0 },
	},
	{ timestamps: true }
);

// Query problems that are due for review (nextReviewDate <= now), soonest first.
progressSchema.index({ nextReviewDate: 1 });

// Reuse the compiled model on hot-reload / repeated imports.
const existing = mongoose.models["Progress"] as Model<IProgress> | undefined;

export const ProgressModel: Model<IProgress> =
	existing ?? mongoose.model<IProgress>("Progress", progressSchema);

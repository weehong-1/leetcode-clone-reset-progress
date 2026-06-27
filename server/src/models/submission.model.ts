import mongoose, { Schema, type Model } from "mongoose";

/**
 * Historical log of a single "Submit" attempt against LeetCode. Unlike
 * {@link IProgress} (mutable, current review state), submissions are immutable
 * records and are preserved across a "soft reset" so the user keeps their
 * full attempt history.
 */
export interface ISubmission {
	/** Links back to the {@link IProgress} document (`Progress.titleSlug`). */
	titleSlug: string;
	/**
	 * LeetCode's submission id returned by the submit/check endpoints. Null for
	 * manual snapshots, which are saved without going through the judge.
	 */
	submissionId: string | null;
	/** Whether this record came from a judged Submit or a manual Snapshot. */
	source: "submit" | "snapshot";
	/** Optional user-given label for the approach (e.g. "Hash map O(n)"). */
	name: string | null;
	/** Optional free-form note / reflection on the approach. */
	note: string | null;
	lang: string;
	code: string;

	// --- Judge result (from the polling worker) ---
	/** e.g. "Accepted", "Wrong Answer". Null for snapshots (no judge result). */
	statusMsg: string | null;
	accepted: boolean;
	runtimeMs: number | null;
	memoryKb: number | null;
	totalCorrect: number | null;
	totalTestcases: number | null;

	// --- Performance scoring (Feature 5) ---
	/** Elapsed solve time used to derive the SM-2 grade, in seconds. */
	durationSeconds: number | null;
	/** SM-2 grade (0–5) assigned to this attempt. */
	grade: number | null;

	// --- Complexity self-assessment + AI validation (Feature 4) ---
	timeComplexity: string | null;
	spaceComplexity: string | null;
	aiComplexityFeedback: string | null;

	// --- Mongoose timestamps ---
	createdAt: Date;
	updatedAt: Date;
}

const submissionSchema = new Schema<ISubmission>(
	{
		titleSlug: { type: String, required: true, trim: true },
		submissionId: { type: String, default: null, trim: true },
		source: {
			type: String,
			enum: ["submit", "snapshot"],
			required: true,
			default: "submit",
		},
		name: { type: String, default: null, trim: true },
		note: { type: String, default: null },
		lang: { type: String, required: true, trim: true },
		code: { type: String, required: true },

		statusMsg: { type: String, default: null, trim: true },
		accepted: { type: Boolean, required: true, default: false },
		runtimeMs: { type: Number, default: null, min: 0 },
		memoryKb: { type: Number, default: null, min: 0 },
		totalCorrect: { type: Number, default: null, min: 0 },
		totalTestcases: { type: Number, default: null, min: 0 },

		durationSeconds: { type: Number, default: null, min: 0 },
		grade: { type: Number, default: null, min: 0, max: 5 },

		timeComplexity: { type: String, default: null, trim: true },
		spaceComplexity: { type: String, default: null, trim: true },
		aiComplexityFeedback: { type: String, default: null },
	},
	{ timestamps: true }
);

// Fetch a problem's attempt history, newest first.
submissionSchema.index({ titleSlug: 1, createdAt: -1 });
// Look up a specific LeetCode submission.
submissionSchema.index({ submissionId: 1 });

const existing = mongoose.models["Submission"] as Model<ISubmission> | undefined;

export const SubmissionModel: Model<ISubmission> =
	existing ?? mongoose.model<ISubmission>("Submission", submissionSchema);

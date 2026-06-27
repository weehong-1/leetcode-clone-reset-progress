import mongoose, { Schema, type Model } from "mongoose";

/**
 * A per-problem "reset cutoff". Solved status is derived live from accepted
 * {@link ISubmission} records, so we can't un-solve a problem by deleting its
 * history. Instead, a reset records `resetAt`, and a problem only counts as
 * solved again once it has an accepted submission *newer* than this timestamp.
 * Written by the "Reset progress" action for problems not in any saved list.
 */
export interface IProgressReset {
	titleSlug: string;
	/** Accepted submissions at or before this instant no longer count as solved. */
	resetAt: Date;

	// --- Mongoose timestamps ---
	createdAt: Date;
	updatedAt: Date;
}

const progressResetSchema = new Schema<IProgressReset>(
	{
		titleSlug: { type: String, required: true, trim: true },
		resetAt: { type: Date, required: true },
	},
	{ timestamps: true }
);

// One cutoff per problem; also the lookup key when computing solved status.
progressResetSchema.index({ titleSlug: 1 }, { unique: true });

const existing = mongoose.models["ProgressReset"] as
	| Model<IProgressReset>
	| undefined;

export const ProgressResetModel: Model<IProgressReset> =
	existing ??
	mongoose.model<IProgressReset>("ProgressReset", progressResetSchema);

import mongoose, { Schema, type Model } from "mongoose";

/**
 * Singleton document holding user-provided secrets that override the
 * environment at runtime (so they can be set from the Settings UI without a
 * server restart). Exactly one row exists, pinned by the unique `key` field.
 * Empty string = "no override" (fall back to env). Values are stored as-is;
 * this is a local single-user app, so the DB is treated as a trusted store.
 */
export interface ISettings {
	/** Discriminator pinning the collection to a single row. */
	key: string;

	openaiApiKey: string;
	openaiBaseUrl: string;
	openaiModel: string;

	leetcodeSession: string;
	csrfToken: string;

	// --- Mongoose timestamps ---
	createdAt: Date;
	updatedAt: Date;
}

const settingsSchema = new Schema<ISettings>(
	{
		key: { type: String, required: true, default: "global", unique: true },
		openaiApiKey: { type: String, default: "" },
		openaiBaseUrl: { type: String, default: "" },
		openaiModel: { type: String, default: "" },
		leetcodeSession: { type: String, default: "" },
		csrfToken: { type: String, default: "" },
	},
	{ timestamps: true }
);

const existing = mongoose.models["Settings"] as Model<ISettings> | undefined;

export const SettingsModel: Model<ISettings> =
	existing ?? mongoose.model<ISettings>("Settings", settingsSchema);

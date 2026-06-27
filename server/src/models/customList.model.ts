import mongoose, { Schema, type Model } from "mongoose";
import type { Difficulty } from "@shared";

/**
 * A problem stored inside a custom list. Metadata is denormalized at add-time
 * (fetched once from LeetCode) so rendering the list needs no further network
 * calls — only the user's solved status is layered on at read time.
 */
export interface ICustomListItem {
	titleSlug: string;
	frontendId: string;
	title: string;
	difficulty: Difficulty;
}

/**
 * A user-created, editable problem list. Distinct from the built-in curated
 * lists (which live in static JSON). `listId` is a stable, URL-safe id used in
 * routes instead of the Mongo `_id`.
 */
export interface ICustomList {
	listId: string;
	name: string;
	items: Array<ICustomListItem>;
	createdAt: Date;
	updatedAt: Date;
}

const customListItemSchema = new Schema<ICustomListItem>(
	{
		titleSlug: { type: String, required: true, trim: true },
		frontendId: { type: String, required: true, trim: true },
		title: { type: String, required: true, trim: true },
		difficulty: {
			type: String,
			enum: ["Easy", "Medium", "Hard"],
			required: true,
		},
	},
	{ _id: false }
);

const customListSchema = new Schema<ICustomList>(
	{
		listId: { type: String, required: true, unique: true, trim: true },
		name: { type: String, required: true, trim: true },
		items: { type: [customListItemSchema], default: [] },
	},
	{ timestamps: true }
);

// Newest lists first when browsing the catalog.
customListSchema.index({ createdAt: -1 });

const existing = mongoose.models["CustomList"] as
	| Model<ICustomList>
	| undefined;

export const CustomListModel: Model<ICustomList> =
	existing ?? mongoose.model<ICustomList>("CustomList", customListSchema);

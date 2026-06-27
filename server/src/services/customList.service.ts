import { randomUUID } from "node:crypto";
import type { HydratedDocument } from "mongoose";
import type { ProblemListDetail, ProblemListSummary } from "@shared";
import {
	CustomListModel,
	type ICustomList,
	type ICustomListItem,
} from "../models/customList.model";
import { CURATED_IDS } from "./curated.service";
import { LeetCodeError, getProblem } from "./leetcode.service";
import { ListError } from "./list.errors";
import {
	countSolved,
	difficultyCounts,
	getSolvedSlugs,
	isDatabaseConnected,
	type ProblemMeta,
	withSolved,
} from "./solved.service";

const MAX_NAME_LENGTH = 80;

/** Normalize a pasted slug or LeetCode URL down to a bare problem slug. */
function normalizeSlug(raw: string): string {
	return raw
		.trim()
		.toLowerCase()
		.replace(/^https?:\/\/leetcode\.com\/problems\//, "")
		.replace(/\/.*$/, "")
		.replace(/[^a-z0-9-]/g, "");
}

function cleanName(raw: string): string {
	const name = raw.trim();
	if (name.length === 0) throw new ListError("List name is required", 400);
	if (name.length > MAX_NAME_LENGTH) {
		throw new ListError(
			`List name must be ${String(MAX_NAME_LENGTH)} characters or fewer`,
			400
		);
	}
	return name;
}

/** Generate a stable, URL-safe id that won't collide with a curated list. */
function generateId(name: string): string {
	const base =
		normalizeSlug(name).slice(0, 32).replace(/^-+|-+$/g, "") || "list";
	let id = `${base}-${randomUUID().slice(0, 8)}`;
	while (CURATED_IDS.has(id)) id = `${base}-${randomUUID().slice(0, 8)}`;
	return id;
}

const itemMeta = (item: ICustomListItem): ProblemMeta => ({
	frontendId: item.frontendId,
	title: item.title,
	titleSlug: item.titleSlug,
	difficulty: item.difficulty,
});

function toSummary(
	list: ICustomList,
	solved: Set<string>
): ProblemListSummary {
	const slugs = list.items.map((item) => item.titleSlug);
	return {
		id: list.listId,
		kind: "custom",
		name: list.name,
		description: "",
		sourceUrl: "",
		total: list.items.length,
		solvedCount: countSolved(slugs, solved),
		difficultyCounts: difficultyCounts(list.items.map(itemMeta)),
	};
}

function toDetail(list: ICustomList, solved: Set<string>): ProblemListDetail {
	return {
		...toSummary(list, solved),
		items: withSolved(list.items.map(itemMeta), solved),
	};
}

/** Fail fast on writes/reads that need the database when it is unavailable. */
function requireDatabase(): void {
	if (!isDatabaseConnected()) {
		throw new ListError("Database unavailable — custom lists need MongoDB", 503);
	}
}

/** Fetch one custom list document or throw a 404. */
async function requireList(
	id: string
): Promise<HydratedDocument<ICustomList>> {
	requireDatabase();
	const list = await CustomListModel.findOne({ listId: id });
	if (!list) throw new ListError(`Unknown list: ${id}`, 404);
	return list;
}

/** Headline metadata for every custom list, newest first. */
export async function listCustomSummaries(): Promise<
	Array<ProblemListSummary>
> {
	// No database, no custom lists — return empty so curated lists still load.
	if (!isDatabaseConnected()) return [];
	const [lists, solved] = await Promise.all([
		CustomListModel.find().sort({ createdAt: -1 }),
		getSolvedSlugs(),
	]);
	return lists.map((list) => toSummary(list, solved));
}

/** Every problem slug across all custom lists (deduplicated). Empty if DB down. */
export async function getCustomSlugs(): Promise<Set<string>> {
	if (!isDatabaseConnected()) return new Set<string>();
	const lists = await CustomListModel.find()
		.select("items.titleSlug")
		.lean<Array<{ items: Array<{ titleSlug: string }> }>>();
	const slugs = new Set<string>();
	for (const list of lists) {
		for (const item of list.items) slugs.add(item.titleSlug);
	}
	return slugs;
}

/** One custom list with its ordered problem rows and per-row solved flags. */
export async function getCustomList(id: string): Promise<ProblemListDetail> {
	const [list, solved] = await Promise.all([
		requireList(id),
		getSolvedSlugs(),
	]);
	return toDetail(list, solved);
}

/** Create an empty custom list. */
export async function createCustomList(
	rawName: string
): Promise<ProblemListSummary> {
	const name = cleanName(rawName);
	requireDatabase();
	const list = await CustomListModel.create({
		listId: generateId(name),
		name,
		items: [],
	});
	return toSummary(list, await getSolvedSlugs());
}

/** Rename a custom list. */
export async function renameCustomList(
	id: string,
	rawName: string
): Promise<ProblemListSummary> {
	const name = cleanName(rawName);
	const list = await requireList(id);
	list.name = name;
	await list.save();
	return toSummary(list, await getSolvedSlugs());
}

/** Delete a custom list. Idempotent. */
export async function deleteCustomList(id: string): Promise<void> {
	requireDatabase();
	const result = await CustomListModel.deleteOne({ listId: id });
	if (result.deletedCount === 0) throw new ListError(`Unknown list: ${id}`, 404);
}

/**
 * Add a problem to a custom list. The slug/URL is normalized and its metadata
 * fetched once from LeetCode and denormalized into the list. Adding a problem
 * already present is a no-op (idempotent).
 */
export async function addProblemToList(
	id: string,
	rawSlug: string
): Promise<ProblemListDetail> {
	const slug = normalizeSlug(rawSlug);
	if (!slug) throw new ListError("A problem slug or URL is required", 400);

	const list = await requireList(id);
	if (!list.items.some((item) => item.titleSlug === slug)) {
		let problem;
		try {
			problem = await getProblem(slug);
		} catch (error) {
			if (error instanceof LeetCodeError) {
				throw new ListError(
					error.statusCode === 404
						? `Problem not found: ${slug}`
						: error.message,
					error.statusCode === 404 ? 404 : 502
				);
			}
			throw error;
		}
		list.items.push({
			titleSlug: problem.titleSlug,
			frontendId: problem.questionFrontendId,
			title: problem.title,
			difficulty: problem.difficulty,
		});
		await list.save();
	}
	return toDetail(list, await getSolvedSlugs());
}

/** Remove a problem from a custom list. Idempotent. */
export async function removeProblemFromList(
	id: string,
	rawSlug: string
): Promise<ProblemListDetail> {
	const slug = normalizeSlug(rawSlug);
	const list = await requireList(id);
	list.items = list.items.filter((item) => item.titleSlug !== slug);
	await list.save();
	return toDetail(list, await getSolvedSlugs());
}

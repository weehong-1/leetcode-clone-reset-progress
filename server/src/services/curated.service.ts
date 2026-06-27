import type {
	Difficulty,
	ProblemListDetail,
	ProblemListSummary,
} from "@shared";
import catalogJson from "../data/problem-catalog.json";
import listsJson from "../data/curated-lists.json";
import { ListError } from "./list.errors";
import {
	countSolved,
	difficultyCounts,
	getSolvedSlugs,
	type ProblemMeta,
	withSolved,
} from "./solved.service";

/** One problem's static metadata, keyed by `titleSlug` in the catalog. */
interface CatalogEntry {
	id: string;
	title: string;
	difficulty: Difficulty;
}

/** A curated list as authored in `curated-lists.json` (slug references only). */
interface ListDefinition {
	id: string;
	name: string;
	description: string;
	sourceUrl: string;
	slugs: Array<string>;
}

const catalog = catalogJson as Record<string, CatalogEntry>;
const listDefinitions = listsJson as Array<ListDefinition>;

/** Curated list ids are reserved — custom lists must not collide with them. */
export const CURATED_IDS: ReadonlySet<string> = new Set(
	listDefinitions.map((list) => list.id)
);

/**
 * Validate the hand-maintained JSON once at module load so authoring typos
 * (an unknown slug, a duplicate within a list) fail loudly at startup rather
 * than surfacing as a confusing 500 later.
 */
function validateData(): void {
	for (const list of listDefinitions) {
		const seen = new Set<string>();
		for (const slug of list.slugs) {
			if (!Object.prototype.hasOwnProperty.call(catalog, slug)) {
				throw new ListError(
					`Curated list "${list.id}" references slug "${slug}" missing from problem-catalog.json`
				);
			}
			if (seen.has(slug)) {
				throw new ListError(
					`Curated list "${list.id}" lists slug "${slug}" more than once`
				);
			}
			seen.add(slug);
		}
	}
}

validateData();

/** Resolve a list's slugs to their catalog metadata, in authored order. */
function metaFor(list: ListDefinition): Array<ProblemMeta> {
	return list.slugs.map((slug) => {
		// Safe: validateData guarantees every list slug exists in the catalog.
		const entry = catalog[slug] as CatalogEntry;
		return {
			frontendId: entry.id,
			title: entry.title,
			titleSlug: slug,
			difficulty: entry.difficulty,
		};
	});
}

function toSummary(
	list: ListDefinition,
	solved: Set<string>
): ProblemListSummary {
	return {
		id: list.id,
		kind: "curated",
		name: list.name,
		description: list.description,
		sourceUrl: list.sourceUrl,
		total: list.slugs.length,
		solvedCount: countSolved(list.slugs, solved),
		difficultyCounts: difficultyCounts(metaFor(list)),
	};
}

/** Headline metadata for every curated list, with the user's solved counts. */
export async function listCuratedSummaries(): Promise<
	Array<ProblemListSummary>
> {
	const solved = await getSolvedSlugs();
	return listDefinitions.map((list) => toSummary(list, solved));
}

/** Whether `id` refers to a built-in curated list. */
export function isCuratedId(id: string): boolean {
	return CURATED_IDS.has(id);
}

/** Every problem slug referenced by any curated list (deduplicated). */
export function getCuratedSlugs(): Set<string> {
	return new Set(listDefinitions.flatMap((list) => list.slugs));
}

/** One curated list with its ordered problem rows and per-row solved flags. */
export async function getCuratedList(id: string): Promise<ProblemListDetail> {
	const list = listDefinitions.find((candidate) => candidate.id === id);
	if (!list) {
		throw new ListError(`Unknown curated list: ${id}`, 404);
	}
	const solved = await getSolvedSlugs();
	return {
		...toSummary(list, solved),
		items: withSolved(metaFor(list), solved),
	};
}

import { describe, expect, it } from "vitest";
import catalogJson from "./problem-catalog.json";
import listsJson from "./curated-lists.json";

/**
 * Guards the hand-maintained curated-list JSON. These are authored by hand, so
 * the failure modes are typos: a list referencing a slug missing from the
 * catalog, a duplicate within a list, or a malformed catalog entry.
 */

const VALID_DIFFICULTIES = new Set(["Easy", "Medium", "Hard"]);

interface CatalogEntry {
	id: string;
	title: string;
	difficulty: string;
}

const catalog = catalogJson as Record<string, CatalogEntry>;
const lists = listsJson as Array<{
	id: string;
	name: string;
	description: string;
	sourceUrl: string;
	slugs: Array<string>;
}>;

const EXPECTED_COUNTS: Record<string, number> = {
	"blind-75": 75,
	"grind-75": 75,
	"top-interview-150": 150,
	"top-100-liked": 100,
};

describe("problem catalog", () => {
	it("has a well-formed entry for every problem", () => {
		for (const [slug, entry] of Object.entries(catalog)) {
			expect(slug, `slug "${slug}"`).toMatch(/^[a-z0-9-]+$/);
			expect(entry.id, `${slug}.id`).toMatch(/^[0-9]+$/);
			expect(entry.title.length, `${slug}.title`).toBeGreaterThan(0);
			expect(VALID_DIFFICULTIES.has(entry.difficulty), `${slug}.difficulty`).toBe(
				true
			);
		}
	});
});

describe("curated lists", () => {
	it("ships the four expected lists with stable ids", () => {
		expect(lists.map((list) => list.id)).toStrictEqual([
			"blind-75",
			"grind-75",
			"top-interview-150",
			"top-100-liked",
		]);
	});

	for (const list of lists) {
		describe(list.id, () => {
			it("has the expected number of problems", () => {
				expect(list.slugs.length).toBe(EXPECTED_COUNTS[list.id]);
			});

			it("references only catalog problems, with no duplicates", () => {
				const seen = new Set<string>();
				for (const slug of list.slugs) {
					expect(catalog, `${list.id} → ${slug}`).toHaveProperty(slug);
					expect(seen.has(slug), `duplicate ${slug} in ${list.id}`).toBe(false);
					seen.add(slug);
				}
			});

			it("has metadata fields", () => {
				expect(list.name.length).toBeGreaterThan(0);
				expect(list.description.length).toBeGreaterThan(0);
				expect(list.sourceUrl).toMatch(/^https?:\/\//);
			});
		});
	}
});

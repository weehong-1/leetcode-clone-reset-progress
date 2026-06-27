import type {
	ProblemListDetail,
	ProblemListSummary,
	ResetProgressResult,
} from "@shared";
import { apiFetch } from "@/services/api";

/** Headline metadata + solved counts for every list (custom first, then curated). */
export function fetchLists(): Promise<Array<ProblemListSummary>> {
	return apiFetch<Array<ProblemListSummary>>("/lists");
}

/** One list with its ordered problems and per-row solved flags. */
export function fetchList(id: string): Promise<ProblemListDetail> {
	return apiFetch<ProblemListDetail>(`/lists/${id}`);
}

/** Create an empty custom list. */
export function createList(name: string): Promise<ProblemListSummary> {
	return apiFetch<ProblemListSummary>("/lists", {
		method: "POST",
		body: JSON.stringify({ name }),
	});
}

/** Rename a custom list. */
export function renameList(
	id: string,
	name: string
): Promise<ProblemListSummary> {
	return apiFetch<ProblemListSummary>(`/lists/${id}`, {
		method: "PATCH",
		body: JSON.stringify({ name }),
	});
}

/** Delete a custom list. */
export function deleteList(id: string): Promise<{ id: string }> {
	return apiFetch<{ id: string }>(`/lists/${id}`, { method: "DELETE" });
}

/** Add a problem (slug or URL) to a custom list; returns the updated detail. */
export function addProblem(
	id: string,
	slug: string
): Promise<ProblemListDetail> {
	return apiFetch<ProblemListDetail>(`/lists/${id}/problems`, {
		method: "POST",
		body: JSON.stringify({ slug }),
	});
}

/** Remove a problem from a custom list; returns the updated detail. */
export function removeProblem(
	id: string,
	slug: string
): Promise<ProblemListDetail> {
	return apiFetch<ProblemListDetail>(`/lists/${id}/problems/${slug}`, {
		method: "DELETE",
	});
}

/**
 * Reset progress for the main problem list. Problems in any saved list (curated
 * or custom) are preserved; submission history is kept. Returns the count of
 * problems that were un-solved.
 */
export function resetMainProgress(): Promise<ResetProgressResult> {
	return apiFetch<ResetProgressResult>("/progress/reset", { method: "POST" });
}

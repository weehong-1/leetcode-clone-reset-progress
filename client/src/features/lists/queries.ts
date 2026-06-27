import {
	useMutation,
	type UseMutationResult,
	useQuery,
	useQueryClient,
	type UseQueryResult,
} from "@tanstack/react-query";
import type {
	ProblemListDetail,
	ProblemListSummary,
	ResetProgressResult,
} from "@shared";
import {
	addProblem,
	createList,
	deleteList,
	fetchList,
	fetchLists,
	removeProblem,
	renameList,
	resetMainProgress,
} from "./api";

const LISTS_KEY = ["lists"] as const;
const listKey = (id: string): Array<string> => ["list", id];

/**
 * List catalog (custom + curated). Solved counts shift as the user submits, so
 * keep this fairly fresh and refetch on window focus (e.g. after solving a
 * problem and returning to Home).
 */
export function useListsQuery(): UseQueryResult<
	Array<ProblemListSummary>,
	Error
> {
	return useQuery({
		queryKey: LISTS_KEY,
		queryFn: fetchLists,
		staleTime: 1000 * 30,
		refetchOnWindowFocus: true,
		retry: false,
	});
}

/** One list's problems. Only runs while a list is selected. */
export function useListQuery(
	id: string | undefined
): UseQueryResult<ProblemListDetail, Error> {
	return useQuery({
		queryKey: listKey(id ?? "none"),
		queryFn: () => fetchList(id as string),
		enabled: id !== undefined,
		staleTime: 1000 * 30,
		refetchOnWindowFocus: true,
		retry: false,
	});
}

/** Create a custom list. Invalidates the catalog so the new card appears. */
export function useCreateListMutation(): UseMutationResult<
	ProblemListSummary,
	Error,
	string
> {
	const client = useQueryClient();
	return useMutation({
		mutationFn: (name: string) => createList(name),
		onSuccess: () => {
			void client.invalidateQueries({ queryKey: LISTS_KEY });
		},
	});
}

/** Rename a custom list. */
export function useRenameListMutation(): UseMutationResult<
	ProblemListSummary,
	Error,
	{ id: string; name: string }
> {
	const client = useQueryClient();
	return useMutation({
		mutationFn: ({ id, name }) => renameList(id, name),
		onSuccess: (_data, { id }) => {
			void client.invalidateQueries({ queryKey: LISTS_KEY });
			void client.invalidateQueries({ queryKey: listKey(id) });
		},
	});
}

/** Delete a custom list. */
export function useDeleteListMutation(): UseMutationResult<
	{ id: string },
	Error,
	string
> {
	const client = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => deleteList(id),
		onSuccess: () => {
			void client.invalidateQueries({ queryKey: LISTS_KEY });
		},
	});
}

/**
 * Add a problem to a custom list. Seeds the detail cache with the response and
 * refreshes the catalog (its counts changed).
 */
export function useAddProblemMutation(
	id: string
): UseMutationResult<ProblemListDetail, Error, string> {
	const client = useQueryClient();
	return useMutation({
		mutationFn: (slug: string) => addProblem(id, slug),
		onSuccess: (detail) => {
			client.setQueryData(listKey(id), detail);
			void client.invalidateQueries({ queryKey: LISTS_KEY });
		},
	});
}

/**
 * Add a problem to an arbitrary list, chosen at call time (drag-drop / context
 * menu). Unlike `useAddProblemMutation`, the list id travels in the variables so
 * a single hook instance can target any list. Same cache updates as that hook.
 */
export function useAddProblemToListMutation(): UseMutationResult<
	ProblemListDetail,
	Error,
	{ listId: string; slug: string }
> {
	const client = useQueryClient();
	return useMutation({
		mutationFn: ({ listId, slug }) => addProblem(listId, slug),
		onSuccess: (detail, { listId }) => {
			client.setQueryData(listKey(listId), detail);
			void client.invalidateQueries({ queryKey: LISTS_KEY });
		},
	});
}

/** Remove a problem from a custom list. */
export function useRemoveProblemMutation(
	id: string
): UseMutationResult<ProblemListDetail, Error, string> {
	const client = useQueryClient();
	return useMutation({
		mutationFn: (slug: string) => removeProblem(id, slug),
		onSuccess: (detail) => {
			client.setQueryData(listKey(id), detail);
			void client.invalidateQueries({ queryKey: LISTS_KEY });
		},
	});
}

/**
 * Reset progress for the main problem list (problems not in any saved list).
 * Refreshes every list's solved counts and any open list detail.
 */
export function useResetMainProgressMutation(): UseMutationResult<
	ResetProgressResult,
	Error,
	void
> {
	const client = useQueryClient();
	return useMutation({
		mutationFn: () => resetMainProgress(),
		onSuccess: () => {
			void client.invalidateQueries({ queryKey: LISTS_KEY });
			void client.invalidateQueries({ queryKey: ["list"] });
		},
	});
}

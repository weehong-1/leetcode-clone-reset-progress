import { Cog6ToothIcon } from "@heroicons/react/24/outline";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type { Difficulty, ProblemListItem, ProblemListSummary } from "@shared";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
	AddToListMenu,
	type MenuPosition,
} from "@/features/lists/components/AddToListMenu";
import {
	useAddProblemToListMutation,
	useCreateListMutation,
	useDeleteListMutation,
	useListQuery,
	useListsQuery,
	useRemoveProblemMutation,
	useResetMainProgressMutation,
} from "@/features/lists/queries";
import { useProblemListQuery } from "@/features/workspace/queries";
import type { FunctionComponent } from "@/common/types";

const PAGE_SIZE = 50;

/** dataTransfer MIME used when dragging a problem onto a custom list card. */
const DRAG_SLUG_TYPE = "application/x-leettrace-slug";

/** Difficulty filter options; `undefined` means "All". */
const DIFFICULTIES: Array<{ label: string; value: Difficulty | undefined }> = [
	{ label: "All", value: undefined },
	{ label: "Easy", value: "Easy" },
	{ label: "Medium", value: "Medium" },
	{ label: "Hard", value: "Hard" },
];

/**
 * Curated subset of common LeetCode topic-tag slugs for the filter dropdown.
 * Not the full tag set — kept here to avoid a second endpoint.
 */
const TOPIC_TAGS: Array<{ label: string; slug: string }> = [
	{ label: "Array", slug: "array" },
	{ label: "String", slug: "string" },
	{ label: "Hash Table", slug: "hash-table" },
	{ label: "Dynamic Programming", slug: "dynamic-programming" },
	{ label: "Math", slug: "math" },
	{ label: "Two Pointers", slug: "two-pointers" },
	{ label: "Greedy", slug: "greedy" },
	{ label: "Sorting", slug: "sorting" },
	{ label: "Depth-First Search", slug: "depth-first-search" },
	{ label: "Breadth-First Search", slug: "breadth-first-search" },
	{ label: "Binary Search", slug: "binary-search" },
	{ label: "Tree", slug: "tree" },
	{ label: "Graph", slug: "graph" },
	{ label: "Stack", slug: "stack" },
	{ label: "Heap (Priority Queue)", slug: "heap-priority-queue" },
	{ label: "Backtracking", slug: "backtracking" },
	{ label: "Linked List", slug: "linked-list" },
	{ label: "Sliding Window", slug: "sliding-window" },
	{ label: "Bit Manipulation", slug: "bit-manipulation" },
];

const slugify = (raw: string): string =>
	raw
		.trim()
		.toLowerCase()
		.replace(/^https?:\/\/leetcode\.com\/problems\//, "")
		.replace(/\/.*$/, "")
		.replace(/[^a-z0-9-]/g, "");

const DIFFICULTY_CLASS: Record<Difficulty, string> = {
	Easy: "text-green-600 dark:text-green-400",
	Medium: "text-amber-600 dark:text-amber-400",
	Hard: "text-red-600 dark:text-red-400",
};

/** Keep only items matching the active search + difficulty filters. */
const filterItems = (
	items: Array<ProblemListItem>,
	search: string,
	difficulty: Difficulty | undefined
): Array<ProblemListItem> => {
	const needle = search.trim().toLowerCase();
	return items.filter((item) => {
		if (difficulty && item.difficulty !== difficulty) return false;
		if (needle && !item.title.toLowerCase().includes(needle)) return false;
		return true;
	});
};

const percent = (
	summary: Pick<ProblemListSummary, "solvedCount" | "total">
): number =>
	summary.total > 0
		? Math.round((summary.solvedCount / summary.total) * 100)
		: 0;

/** One selectable list card in the right-hand column. */
const ListCard = ({
	summary,
	active,
	onSelect,
	onDelete,
	dragActive = false,
	onDropSlug,
}: {
	summary: ProblemListSummary;
	active: boolean;
	onSelect: () => void;
	onDelete?: () => void;
	/** A problem drag is in progress, so hint that this card accepts a drop. */
	dragActive?: boolean;
	/** Drop handler; presence makes the card a valid drop target. */
	onDropSlug?: (slug: string) => void;
}): FunctionComponent => {
	const pct = percent(summary);
	const [over, setOver] = useState(false);

	const droppable = onDropSlug !== undefined;
	const dropRing = over
		? "ring-2 ring-blue-500"
		: dragActive
			? "ring-2 ring-dashed ring-blue-300 dark:ring-blue-500/50"
			: "";

	return (
		<div
			className={`group relative rounded-lg border p-3 transition-colors ${
				active
					? "border-blue-500 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/40"
					: "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700"
			} ${dropRing}`}
			onDragLeave={droppable ? (): void => { setOver(false); } : undefined}
			onDragOver={
				droppable
					? (event): void => {
							event.preventDefault();
							event.dataTransfer.dropEffect = "copy";
							setOver(true);
						}
					: undefined
			}
			onDrop={
				droppable
					? (event): void => {
							event.preventDefault();
							setOver(false);
							const slug = event.dataTransfer.getData(DRAG_SLUG_TYPE);
							if (slug) onDropSlug(slug);
						}
					: undefined
			}
		>
			<button
				className="block w-full text-left"
				type="button"
				onClick={onSelect}
			>
				<div className="flex items-center justify-between gap-2">
					<span className="truncate text-base font-semibold text-gray-900 dark:text-gray-100">
						{summary.name}
					</span>
					<span className="shrink-0 text-xs tabular-nums text-gray-500 dark:text-gray-400">
						{summary.solvedCount}/{summary.total}
					</span>
				</div>
				<div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
					<div
						className="h-full rounded-full bg-green-500 transition-all"
						style={{ width: `${pct.toString()}%` }}
					/>
				</div>
			</button>
			{onDelete && (
				<button
					className="absolute right-1.5 top-1.5 hidden rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600 group-hover:block dark:hover:bg-gray-800"
					title="Delete list"
					type="button"
					onClick={onDelete}
				>
					🗑
				</button>
			)}
		</div>
	);
};

export const Home = (): FunctionComponent => {
	const navigate = useNavigate();

	const [search, setSearch] = useState("");
	const [difficulty, setDifficulty] = useState<Difficulty | undefined>(
		undefined
	);
	const [tag, setTag] = useState<string>("");
	const [skip, setSkip] = useState(0);
	/** `undefined` = browse the full live problem set ("All Problems"). */
	const [listId, setListId] = useState<string | undefined>(undefined);

	const [creating, setCreating] = useState(false);
	const [newName, setNewName] = useState("");

	/** Slug currently being dragged (lights up drop targets), or null. */
	const [draggingSlug, setDraggingSlug] = useState<string | null>(null);
	/** Open right-click menu: cursor position + the targeted problem slug. */
	const [menu, setMenu] = useState<
		(MenuPosition & { slug: string }) | null
	>(null);

	const open = (raw: string): void => {
		const slug = slugify(raw);
		if (slug) {
			void navigate({ to: "/problems/$slug", params: { slug } });
		}
	};

	const listsQuery = useListsQuery();
	const listQuery = useListQuery(listId);

	const createMutation = useCreateListMutation();
	const deleteMutation = useDeleteListMutation();
	const addToListMutation = useAddProblemToListMutation();
	const removeMutation = useRemoveProblemMutation(listId ?? "");
	const resetMutation = useResetMainProgressMutation();

	/** Reset progress for problems not in any list (curated + custom preserved). */
	const confirmReset = (): void => {
		if (
			!window.confirm(
				"Reset progress for all problems that aren't in any list?\n\n" +
					"Your curated and custom list progress is preserved, and your " +
					"submission history is kept."
			)
		) {
			return;
		}
		resetMutation.mutate(undefined, {
			onSuccess: ({ resetCount }) => {
				window.alert(
					`Reset ${resetCount.toString()} problem${resetCount === 1 ? "" : "s"}.`
				);
			},
		});
	};

	const problemsQuery = useProblemListQuery({
		limit: PAGE_SIZE,
		skip,
		difficulty,
		search: search.trim() || undefined,
		tags: tag ? [tag] : undefined,
	});

	const inList = listId !== undefined;

	const total = problemsQuery.data?.total ?? 0;
	const questions = problemsQuery.data?.questions ?? [];
	const pageEnd = Math.min(skip + PAGE_SIZE, total);

	const activeList = listQuery.data;
	const isCustom = activeList?.kind === "custom";
	const listItems = filterItems(activeList?.items ?? [], search, difficulty);
	const completionPct = activeList ? percent(activeList) : 0;

	const summaries = listsQuery.data ?? [];
	const customLists = summaries.filter((list) => list.kind === "custom");
	const curatedLists = summaries.filter((list) => list.kind === "curated");

	/** Reset to the first page whenever a filter changes. */
	const resetPaging = (): void => { setSkip(0); };

	/** Switch the active list, toggling back to the full set if re-clicked. */
	const selectList = (id: string): void => {
		setListId((current) => (current === id ? undefined : id));
		resetPaging();
	};

	const showAll = (): void => {
		setListId(undefined);
		resetPaging();
	};

	const submitCreate = (): void => {
		const name = newName.trim();
		if (!name) return;
		createMutation.mutate(name, {
			onSuccess: (summary) => {
				setNewName("");
				setCreating(false);
				setListId(summary.id);
				resetPaging();
			},
		});
	};

	const confirmDelete = (summary: ProblemListSummary): void => {
		if (!window.confirm(`Delete the list "${summary.name}"?`)) return;
		deleteMutation.mutate(summary.id, {
			onSuccess: () => {
				if (listId === summary.id) showAll();
			},
		});
	};

	return (
		<div className="relative flex min-h-screen flex-col items-center bg-gray-50 px-4 py-12 dark:bg-gray-950">
			<div className="absolute right-4 top-4 z-30 flex items-center gap-2">
				<Link
					aria-label="Settings"
					className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-2.5 py-1 text-base text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
					title="Settings"
					to="/settings"
				>
					<Cog6ToothIcon className="h-4 w-4" />
				</Link>
				<ThemeToggle showLabels={false} />
			</div>
			<AddToListMenu
				lists={customLists}
				position={menu}
				onClose={(): void => { setMenu(null); }}
				onPick={(targetId): void => {
					if (menu) {
						addToListMutation.mutate({ listId: targetId, slug: menu.slug });
					}
					setMenu(null);
				}}
			/>
			<div className="w-full max-w-6xl">
				<h1 className="mb-1 text-center text-2xl font-bold text-gray-900 dark:text-gray-100">
					LeetTrace
				</h1>
				<p className="mb-6 text-center text-base text-gray-500 dark:text-gray-400">
					Pick a list on the right, or browse all problems below to start a
					timed challenge.
				</p>

				<div className="mt-8 flex flex-col gap-6 lg:flex-row lg:items-start">
					{/* Left: problem browser */}
					<div className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
						{/* Completion header (list mode only) */}
						{inList && activeList && (
							<div className="border-b border-gray-200 p-3 dark:border-gray-800">
								<div className="mb-1.5 flex items-center justify-between gap-2 text-base">
									<span className="truncate font-semibold text-gray-900 dark:text-gray-100">
										{activeList.name}
									</span>
									<button
										className="shrink-0 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
										type="button"
										onClick={showAll}
									>
										← All problems
									</button>
								</div>
								<div className="mb-1.5 text-xs tabular-nums text-gray-500 dark:text-gray-400">
									{activeList.solvedCount}/{activeList.total} solved (
									{completionPct}%)
								</div>
								<div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
									<div
										className="h-full rounded-full bg-green-500 transition-all"
										style={{ width: `${completionPct.toString()}%` }}
									/>
								</div>
								<div className="mt-1.5 flex items-center gap-3 text-xs">
									<span className={DIFFICULTY_CLASS.Easy}>
										Easy {activeList.difficultyCounts.Easy}
									</span>
									<span className={DIFFICULTY_CLASS.Medium}>
										Medium {activeList.difficultyCounts.Medium}
									</span>
									<span className={DIFFICULTY_CLASS.Hard}>
										Hard {activeList.difficultyCounts.Hard}
									</span>
								</div>
							</div>
						)}


						<div className="flex flex-wrap items-center gap-2 border-b border-gray-200 p-3 dark:border-gray-800">
							<input
								className="min-w-[12rem] flex-1 rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
								placeholder="Search problems…"
								value={search}
								onChange={(event): void => {
									setSearch(event.target.value);
									resetPaging();
								}}
							/>
							{/* Topic-tag filter applies to the live set only. */}
							{!inList && (
								<select
									className="rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
									value={tag}
									onChange={(event): void => {
										setTag(event.target.value);
										resetPaging();
									}}
								>
									<option value="">All topics</option>
									{TOPIC_TAGS.map((topic) => (
										<option key={topic.slug} value={topic.slug}>
											{topic.label}
										</option>
									))}
								</select>
							)}
							{/* Resets progress for problems not in any list; lists are
							    reset from the list itself. Main-list view only. */}
							{!inList && (
								<button
									className="ml-auto shrink-0 cursor-pointer rounded-lg border border-red-300 px-3 py-2 text-base font-medium text-red-600 enabled:hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:enabled:hover:bg-red-950/40"
									disabled={resetMutation.isPending}
									title="Reset progress for all problems not in a curated or custom list (history preserved)"
									type="button"
									onClick={confirmReset}
								>
									{resetMutation.isPending ? "Resetting…" : "Reset progress"}
								</button>
							)}
						</div>

						<div className="flex flex-wrap gap-1 border-b border-gray-200 p-3 dark:border-gray-800">
							{DIFFICULTIES.map((option) => {
								const active = option.value === difficulty;
								return (
									<button
										key={option.label}
										type="button"
										className={`rounded-full px-3 py-1 text-xs font-semibold ${
											active
												? "bg-blue-600 text-white"
												: "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
										}`}
										onClick={(): void => {
											setDifficulty(option.value);
											resetPaging();
										}}
									>
										{option.label}
									</button>
								);
							})}
						</div>

						{/* Rows */}
						{inList ? (
							<ul className="divide-y divide-gray-100 dark:divide-gray-800">
								{listQuery.isPending ? (
									<li className="p-6 text-center text-base text-gray-400 dark:text-gray-500">
										Loading list…
									</li>
								) : listQuery.isError ? (
									<li className="p-6 text-center text-base text-red-600 dark:text-red-400">
										{listQuery.error.message}
									</li>
								) : listItems.length === 0 ? (
									<li className="p-6 text-center text-base text-gray-400 dark:text-gray-500">
										{isCustom
											? "No problems yet. Add one above."
											: "No problems match these filters."}
									</li>
								) : (
									listItems.map((item) => (
										<li
											key={item.titleSlug}
											className="group flex items-center hover:bg-gray-50 dark:hover:bg-gray-800"
										>
											<button
												className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 px-4 py-2.5 text-left"
												type="button"
												onClick={(): void => { open(item.titleSlug); }}
											>
												<span
													title={item.solved ? "Solved" : "Not solved"}
													className={`w-4 shrink-0 text-center text-base ${
														item.solved
															? "text-green-500"
															: "text-gray-300 dark:text-gray-600"
													}`}
												>
													{item.solved ? "✓" : "○"}
												</span>
												<span className="w-12 shrink-0 text-xs tabular-nums text-gray-400 dark:text-gray-500">
													{item.frontendId}
												</span>
												<span className="flex-1 truncate text-base text-gray-900 dark:text-gray-100">
													{item.title}
												</span>
												<span
													className={`w-16 shrink-0 text-right text-xs font-semibold ${DIFFICULTY_CLASS[item.difficulty]}`}
												>
													{item.difficulty}
												</span>
											</button>
											{isCustom && (
												<button
													className="mr-2 hidden shrink-0 rounded p-1.5 text-gray-400 hover:bg-gray-200 hover:text-red-600 group-hover:block dark:hover:bg-gray-700"
													title="Remove from list"
													type="button"
													onClick={(): void => {
														removeMutation.mutate(item.titleSlug);
													}}
												>
													✕
												</button>
											)}
										</li>
									))
								)}
							</ul>
						) : (
							<ul className="divide-y divide-gray-100 dark:divide-gray-800">
								{problemsQuery.isPending ? (
									<li className="p-6 text-center text-base text-gray-400 dark:text-gray-500">
										Loading problems…
									</li>
								) : problemsQuery.isError ? (
									<li className="p-6 text-center text-base text-red-600 dark:text-red-400">
										{problemsQuery.error.message}
									</li>
								) : questions.length === 0 ? (
									<li className="p-6 text-center text-base text-gray-400 dark:text-gray-500">
										No problems match these filters.
									</li>
								) : (
									questions.map((q) => (
										<li key={q.titleSlug}>
											<button
												draggable
												className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800"
												type="button"
												onClick={(): void => { open(q.titleSlug); }}
												onDragEnd={(): void => { setDraggingSlug(null); }}
												onContextMenu={(event): void => {
													event.preventDefault();
													setMenu({
														x: event.clientX,
														y: event.clientY,
														slug: q.titleSlug,
													});
												}}
												onDragStart={(event): void => {
													event.dataTransfer.setData(
														DRAG_SLUG_TYPE,
														q.titleSlug
													);
													event.dataTransfer.effectAllowed = "copy";
													setDraggingSlug(q.titleSlug);
												}}
											>
												<span className="w-12 shrink-0 text-xs tabular-nums text-gray-400 dark:text-gray-500">
													{q.questionFrontendId}
												</span>
												<span className="flex-1 truncate text-base text-gray-900 dark:text-gray-100">
													{q.title}
													{q.paidOnly && (
														<span
															className="ml-2 align-middle text-xs text-amber-500"
															title="Premium problem — requires LeetCode auth"
														>
															🔒
														</span>
													)}
												</span>
												<span className="w-16 shrink-0 text-right text-xs tabular-nums text-gray-400 dark:text-gray-500">
													{q.acRate.toFixed(1)}%
												</span>
												<span
													className={`w-16 shrink-0 text-right text-xs font-semibold ${DIFFICULTY_CLASS[q.difficulty]}`}
												>
													{q.difficulty}
												</span>
											</button>
										</li>
									))
								)}
							</ul>
						)}

						{/* Footer */}
						{inList ? (
							<div className="flex items-center justify-between border-t border-gray-200 p-3 text-base dark:border-gray-800">
								<span className="text-gray-500 dark:text-gray-400">
									{activeList
										? `${listItems.length.toString()} of ${activeList.total.toString()} shown`
										: "—"}
								</span>
							</div>
						) : (
							<div className="flex items-center justify-between border-t border-gray-200 p-3 text-base dark:border-gray-800">
								<span className="text-gray-500 dark:text-gray-400">
									{total > 0
										? `${(skip + 1).toString()}–${pageEnd.toString()} of ${total.toString()}`
										: "—"}
								</span>
								<div className="flex gap-2">
									<button
										className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
										disabled={skip === 0}
										type="button"
										onClick={(): void => {
											setSkip((current) => Math.max(0, current - PAGE_SIZE));
										}}
									>
										← Prev
									</button>
									<button
										className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
										disabled={pageEnd >= total}
										type="button"
										onClick={(): void => {
											setSkip((current) => current + PAGE_SIZE);
										}}
									>
										Next →
									</button>
								</div>
							</div>
						)}
					</div>

					{/* Right: list cards */}
					<aside className="no-scrollbar sticky top-4 z-10 order-first max-h-[calc(100vh-2rem)] w-full shrink-0 overflow-y-hidden bg-gray-50 dark:bg-gray-950 lg:order-none lg:z-auto lg:w-72 lg:overflow-y-auto">
						<div className="no-scrollbar -mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-2 lg:snap-none lg:flex-col lg:overflow-visible lg:pb-0">
							{/* Create-new card — pinned to the left on small screens */}
							<div className="sticky left-0 z-10 w-44 shrink-0 snap-start bg-gray-50 dark:bg-gray-950 lg:static lg:z-auto lg:w-full lg:bg-transparent">
							{creating ? (
								<form
									className="rounded-lg border border-blue-500 bg-blue-50 p-3 dark:border-blue-500 dark:bg-blue-950/40"
									onSubmit={(event): void => {
										event.preventDefault();
										submitCreate();
									}}
								>
									<input
										className="w-full rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
										placeholder="List name…"
										value={newName}
										onChange={(event): void => { setNewName(event.target.value); }}
									/>
									{createMutation.isError && (
										<p className="mt-1 text-xs text-red-600 dark:text-red-400">
											{createMutation.error.message}
										</p>
									)}
									<div className="mt-2 flex gap-2">
										<button
											className="flex-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
											type="submit"
											disabled={
												newName.trim().length === 0 || createMutation.isPending
											}
										>
											{createMutation.isPending ? "Creating…" : "Create"}
										</button>
										<button
											className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
											type="button"
											onClick={(): void => {
												setCreating(false);
												setNewName("");
											}}
										>
											Cancel
										</button>
									</div>
								</form>
							) : (
								<div className="flex items-center gap-1.5">
									<button
										className="flex h-full flex-1 items-center rounded-lg border border-dashed border-gray-300 p-3 text-left text-base font-semibold text-gray-600 hover:border-blue-400 hover:text-blue-600 dark:border-gray-700 dark:text-gray-300 dark:hover:border-blue-500 dark:hover:text-blue-400"
										type="button"
										onClick={(): void => { setCreating(true); }}
									>
										＋ Create new collection
									</button>
									<span className="group relative inline-flex shrink-0">
										<span className="flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-gray-300 text-[10px] font-bold text-gray-400 dark:border-gray-600 dark:text-gray-500">
											?
										</span>
										<span className="pointer-events-none absolute right-0 top-6 z-40 hidden w-56 rounded-lg border border-gray-200 bg-white p-2.5 text-xs font-normal text-gray-600 shadow-lg group-hover:block dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
											Browse <span className="font-semibold">All problems</span>, then{" "}
											<span className="font-semibold">drag</span> a problem onto a
											collection to add it — or{" "}
											<span className="font-semibold">right-click</span> a problem
											for a menu of your collections.
										</span>
									</span>
								</div>
							)}
							</div>

							{customLists.map((list) => (
								<div key={list.id} className="w-44 shrink-0 snap-start lg:w-full">
									<ListCard
										active={list.id === listId}
										dragActive={draggingSlug !== null}
										summary={list}
										onDelete={(): void => { confirmDelete(list); }}
										onSelect={(): void => { selectList(list.id); }}
										onDropSlug={(slug): void => {
											addToListMutation.mutate({ listId: list.id, slug });
										}}
									/>
								</div>
							))}

							{curatedLists.map((list) => (
								<div key={list.id} className="w-44 shrink-0 snap-start lg:w-full">
									<ListCard
										active={list.id === listId}
										summary={list}
										onSelect={(): void => { selectList(list.id); }}
									/>
								</div>
							))}
						</div>
					</aside>
				</div>
			</div>
		</div>
	);
};

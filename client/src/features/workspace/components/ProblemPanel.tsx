import { ArrowPathIcon } from "@heroicons/react/24/outline";
import DOMPurify from "dompurify";
import { useMemo } from "react";
import type { LeetCodeProblem } from "@shared";
import type { FunctionComponent } from "@/common/types";
import { useRefreshProblemMutation } from "../queries";
import { DifficultyBadge } from "./DifficultyBadge";

export const ProblemPanel = ({
	problem,
}: {
	problem: LeetCodeProblem;
}): FunctionComponent => {
	// Sanitize the proxied LeetCode HTML before injecting it (XSS defense).
	const safeHtml = useMemo(
		(): string => DOMPurify.sanitize(problem.content),
		[problem.content]
	);

	const refresh = useRefreshProblemMutation(problem.titleSlug);

	return (
		<div className="flex h-full flex-col overflow-y-auto bg-white p-6 dark:bg-gray-900">
			<div className="mb-3 flex items-center gap-3">
				<h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
					{problem.questionFrontendId}. {problem.title}
				</h1>
				<DifficultyBadge difficulty={problem.difficulty} />
				<button
					className="ml-auto inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-gray-300 px-2.5 py-1 text-base font-medium text-gray-700 enabled:hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:enabled:hover:bg-gray-800"
					disabled={refresh.isPending}
					title="Re-fetch this question from LeetCode and update the saved copy"
					type="button"
					onClick={() => refresh.mutate()}
				>
					<ArrowPathIcon
						className={`h-4 w-4 ${refresh.isPending ? "animate-spin" : ""}`}
					/>
					{refresh.isPending ? "Refreshing…" : "Refresh"}
				</button>
			</div>

			{refresh.isError && (
				<p className="mb-3 text-base text-red-600 dark:text-red-400">
					Couldn’t refresh from LeetCode: {refresh.error.message}
				</p>
			)}

			{problem.topicTags.length > 0 && (
				<div className="mb-4 flex flex-wrap gap-2">
					{problem.topicTags.map((tag) => (
						<span
							key={tag}
							className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300"
						>
							{tag}
						</span>
					))}
				</div>
			)}

			{/* safeHtml is sanitized with DOMPurify above */}
			<div
				dangerouslySetInnerHTML={{ __html: safeHtml }}
				className="problem-content"
			/>
		</div>
	);
};

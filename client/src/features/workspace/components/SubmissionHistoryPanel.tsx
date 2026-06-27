import { ArrowUpTrayIcon, TrashIcon } from "@heroicons/react/24/outline";
import type { Submission } from "@shared";
import type { FunctionComponent } from "@/common/types";
import {
	useDeleteSubmissionMutation,
	useSubmissionsQuery,
	useUpdateSubmissionMutation,
} from "../queries";

interface SubmissionHistoryPanelProps {
	slug: string;
	/** Load a past entry's code back into the editor to revise it. */
	onLoadCode: (lang: string, code: string) => void;
}

/** Human-friendly "x ago" from an ISO timestamp. */
function timeAgo(iso: string): string {
	const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
	if (seconds < 60) return "just now";
	const minutes = Math.round(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.round(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.round(hours / 24);
	if (days < 30) return `${days}d ago`;
	return new Date(iso).toLocaleDateString();
}

function StatusBadge({ entry }: { entry: Submission }): FunctionComponent {
	if (entry.source === "snapshot") {
		return (
			<span className="rounded bg-gray-700 px-1.5 py-0.5 text-xs text-gray-300">
				Save Answer
			</span>
		);
	}
	return (
		<span
			className={`rounded px-1.5 py-0.5 text-xs ${
				entry.accepted
					? "bg-green-500/15 text-green-400"
					: "bg-red-500/15 text-red-400"
			}`}
		>
			{entry.statusMsg ?? "Submitted"}
		</span>
	);
}

export const SubmissionHistoryPanel = ({
	slug,
	onLoadCode,
}: SubmissionHistoryPanelProps): FunctionComponent => {
	const query = useSubmissionsQuery(slug);
	const updateMutation = useUpdateSubmissionMutation(slug);
	const deleteMutation = useDeleteSubmissionMutation(slug);

	return (
		<div className="h-full overflow-y-auto bg-gray-900 p-4 text-base text-gray-200">
			<h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
				History
			</h2>

			{query.isPending && <p className="text-gray-500">Loading history…</p>}

			{query.isError && (
				<div className="rounded border border-amber-500/40 bg-amber-500/10 p-3 text-amber-300">
					{query.error.message ||
						"Submission history needs MongoDB running. Start it and refresh."}
				</div>
			)}

			{query.isSuccess && query.data.length === 0 && (
				<p className="text-gray-500">
					No history yet. Submit a solution or save a snapshot to start building
					your approaches.
				</p>
			)}

			{query.isSuccess && query.data.length > 0 && (
				<ul className="space-y-3">
					{query.data.map((entry) => (
						<li
							key={entry.id}
							className="rounded-lg border border-gray-800 bg-gray-950/40 p-3"
						>
							<div className="mb-2 flex flex-wrap items-center gap-2">
								<StatusBadge entry={entry} />
								<span className="text-xs text-gray-400">{entry.lang}</span>
								{entry.runtimeMs !== null && (
									<span className="text-xs text-gray-500">
										{entry.runtimeMs} ms
									</span>
								)}
								{entry.memoryKb !== null && (
									<span className="text-xs text-gray-500">
										{(entry.memoryKb / 1024).toFixed(1)} MB
									</span>
								)}
								<span className="ml-auto text-xs text-gray-500">
									{timeAgo(entry.createdAt)}
								</span>
							</div>

							<input
								key={`name-${entry.id}-${entry.updatedAt}`}
								className="mb-2 w-full rounded border border-gray-700 bg-gray-800 px-2 py-1 text-base text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
								defaultValue={entry.name ?? ""}
								placeholder="Name this approach… (e.g. Hash map O(n))"
								onBlur={(event): void => {
									const value = event.target.value.trim();
									if (value !== (entry.name ?? "")) {
										updateMutation.mutate({ id: entry.id, body: { name: value } });
									}
								}}
							/>
							<textarea
								key={`note-${entry.id}-${entry.updatedAt}`}
								className="w-full resize-y rounded border border-gray-700 bg-gray-800 px-2 py-1 text-base text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
								defaultValue={entry.note ?? ""}
								placeholder="Notes (trade-offs, complexity, what to try next)…"
								rows={2}
								onBlur={(event): void => {
									const value = event.target.value;
									if (value !== (entry.note ?? "")) {
										updateMutation.mutate({ id: entry.id, body: { note: value } });
									}
								}}
							/>

							<div className="mt-2 flex gap-2">
								<button
									className="flex items-center gap-1 rounded border border-gray-700 px-2 py-1 text-xs text-gray-300 hover:bg-gray-800"
									type="button"
									onClick={(): void => { onLoadCode(entry.lang, entry.code); }}
								>
									<ArrowUpTrayIcon className="h-3.5 w-3.5" />
									Load into editor
								</button>
								<button
									className="flex items-center gap-1 rounded border border-gray-700 px-2 py-1 text-xs text-red-400 hover:bg-gray-800"
									disabled={deleteMutation.isPending}
									type="button"
									onClick={(): void => { deleteMutation.mutate(entry.id); }}
								>
									<TrashIcon className="h-3.5 w-3.5" />
									Delete
								</button>
							</div>
						</li>
					))}
				</ul>
			)}
		</div>
	);
};

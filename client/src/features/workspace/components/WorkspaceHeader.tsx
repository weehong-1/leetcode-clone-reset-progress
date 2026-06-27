import {
	ChatBubbleLeftRightIcon,
	ClockIcon,
	Cog6ToothIcon,
} from "@heroicons/react/24/outline";
import { Link } from "@tanstack/react-router";
import type { CodeSnippet, Difficulty } from "@shared";
import type { FunctionComponent } from "@/common/types";
import { DifficultyBadge } from "./DifficultyBadge";
import { PreferencesMenu } from "./PreferencesMenu";

interface WorkspaceHeaderProps {
	title: string;
	frontendId: string;
	difficulty: Difficulty;
	snippets: Array<CodeSnippet>;
	langSlug: string;
	onLangChange: (langSlug: string) => void;
	elapsed: string;
	challengeStarted: boolean;
	busy: boolean;
	formatting: boolean;
	snapshotting: boolean;
	canFormat: boolean;
	canRun: boolean;
	canSnapshot: boolean;
	canSubmit: boolean;
	tutorOpen: boolean;
	onToggleTutor: () => void;
	onFormat: () => void;
	onRun: () => void;
	onSnapshot: () => void;
	onSubmit: () => void;
}

export const WorkspaceHeader = ({
	title,
	frontendId,
	difficulty,
	snippets,
	langSlug,
	onLangChange,
	elapsed,
	challengeStarted,
	busy,
	formatting,
	snapshotting,
	canFormat,
	canRun,
	canSnapshot,
	canSubmit,
	tutorOpen,
	onToggleTutor,
	onFormat,
	onRun,
	onSnapshot,
	onSubmit,
}: WorkspaceHeaderProps): FunctionComponent => {
	const tutorButtonClass = `flex items-center gap-1 rounded-md border px-3 py-1.5 text-base font-medium transition ${
		tutorOpen
			? "border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400"
			: "border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
	}`;
	return (
		<header className="flex items-center gap-4 border-b border-gray-200 bg-white px-4 py-2 dark:border-gray-800 dark:bg-gray-900">
			<Link
				className="text-base text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
				to="/"
			>
				← Problems
			</Link>

			<div className="flex items-center gap-2">
				<span className="text-base font-semibold text-gray-900 dark:text-gray-100">
					{frontendId}. {title}
				</span>
				<DifficultyBadge difficulty={difficulty} />
			</div>

			<div className="flex items-center gap-1 text-base tabular-nums text-gray-600 dark:text-gray-400">
				<ClockIcon className="h-4 w-4" />
				<span
					className={
						challengeStarted
							? "text-gray-900 dark:text-gray-100"
							: "text-gray-300 dark:text-gray-600"
					}
				>
					{elapsed}
				</span>
			</div>

			<div className="ml-auto flex items-center gap-2">
				<select
					className="rounded-md border border-gray-300 px-2 py-1.5 text-base text-gray-700 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
					value={langSlug}
					onChange={(event): void => {
						onLangChange(event.target.value);
					}}
				>
					{snippets.map((snippet) => (
						<option key={snippet.langSlug} value={snippet.langSlug}>
							{snippet.lang}
						</option>
					))}
				</select>

				<PreferencesMenu />

				<Link
					aria-label="Settings"
					className="inline-flex items-center rounded-md border border-gray-300 px-2.5 py-1.5 text-base text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
					title="Settings"
					to="/settings"
				>
					<Cog6ToothIcon className="h-4 w-4" />
				</Link>

				<button
					className={tutorButtonClass}
					title="Toggle the AI tutor"
					type="button"
					onClick={onToggleTutor}
				>
					<ChatBubbleLeftRightIcon className="h-4 w-4" />
					Tutor
				</button>

				<button
					className="rounded-md border border-gray-300 px-4 py-1.5 text-base font-medium text-gray-700 enabled:hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:enabled:hover:bg-gray-800"
					disabled={!canSnapshot}
					title="Save the current code as a named answer"
					type="button"
					onClick={onSnapshot}
				>
					{snapshotting ? "…" : "Save Answer"}
				</button>
				<button
					className="rounded-md border border-gray-300 px-4 py-1.5 text-base font-medium text-gray-700 enabled:hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:enabled:hover:bg-gray-800"
					disabled={!canFormat}
					title="Format code (Shift+Alt+F)"
					type="button"
					onClick={onFormat}
				>
					{formatting ? "…" : "Format"}
				</button>
				<button
					className="rounded-md border border-gray-300 px-4 py-1.5 text-base font-medium text-gray-700 enabled:hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:enabled:hover:bg-gray-800"
					disabled={!canRun}
					type="button"
					onClick={onRun}
				>
					Run
				</button>
				<button
					className="rounded-md bg-green-500 px-4 py-1.5 text-base font-semibold text-white enabled:hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-50"
					disabled={!canSubmit}
					type="button"
					onClick={onSubmit}
				>
					{busy ? "…" : "Submit"}
				</button>
			</div>
		</header>
	);
};

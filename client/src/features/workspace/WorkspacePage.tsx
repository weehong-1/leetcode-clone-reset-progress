import { useParams } from "@tanstack/react-router";
import { type PointerEvent as ReactPointerEvent, useMemo, useState } from "react";
import type { FunctionComponent } from "@/common/types";
import { useEditorPreferences } from "@/store/useEditorPreferences";
import { ComplexityModal } from "./components/ComplexityModal";
import { EditorPanel } from "./components/EditorPanel";
import { ProblemPanel } from "./components/ProblemPanel";
import { ResultsPanel } from "./components/ResultsPanel";
import { SaveAnswerDialog } from "./components/SaveAnswerDialog";
import { SubmissionHistoryPanel } from "./components/SubmissionHistoryPanel";
import { TutorPanel } from "./components/TutorPanel";
import { WorkspaceHeader } from "./components/WorkspaceHeader";
import { pickDefaultSnippet } from "./language";
import {
	useCreateSnapshotMutation,
	useFormatMutation,
	useProblemQuery,
	useRunMutation,
	useSubmitMutation,
} from "./queries";
import { useStopwatch } from "./useStopwatch";

type LastAction = "run" | "submit" | null;
type BottomTab = "console" | "history";

/** Inner body, remounted per slug (via `key`) so all attempt state resets. */
const Workspace = ({ slug }: { slug: string }): FunctionComponent => {
	const query = useProblemQuery(slug);
	const fontFamily = useEditorPreferences((s) => s.fontFamily);
	const fontSize = useEditorPreferences((s) => s.fontSize);

	const [challengeStarted, setChallengeStarted] = useState(false);
	// null = "follow the problem's default language"; a value = explicit choice.
	const [selectedLang, setSelectedLang] = useState<string | null>(null);
	// Only stores languages the user has edited; unedited langs fall back to the
	// LeetCode starter snippet. Avoids any state-seeding effect.
	const [codeByLang, setCodeByLang] = useState<Record<string, string>>({});
	const [lastAction, setLastAction] = useState<LastAction>(null);
	const [formatNotice, setFormatNotice] = useState<string | null>(null);
	const [bottomTab, setBottomTab] = useState<BottomTab>("console");
	// Controls the Save Answer pop-out.
	const [saveOpen, setSaveOpen] = useState(false);
	// AI assistant: right-side tutor pane + post-submit complexity modal.
	const [tutorOpen, setTutorOpen] = useState(false);
	const [complexityOpen, setComplexityOpen] = useState(false);
	// Elapsed seconds captured at the moment Submit was pressed (drives grading).
	const [submitElapsed, setSubmitElapsed] = useState(0);
	// The code that produced the Accepted result, frozen for complexity analysis.
	const [acceptedCode, setAcceptedCode] = useState("");
	// Height (px) of the bottom console/history panel; drag the splitter to resize.
	const [consoleHeight, setConsoleHeight] = useState(224);

	/** Drag the splitter to resize the console. Dragging up grows the console. */
	const startConsoleResize = (event: ReactPointerEvent): void => {
		event.preventDefault();
		const startY = event.clientY;
		const startHeight = consoleHeight;
		const onMove = (move: PointerEvent): void => {
			const next = startHeight - (move.clientY - startY);
			const max = Math.max(120, window.innerHeight - 220);
			setConsoleHeight(Math.min(Math.max(next, 120), max));
		};
		const onUp = (): void => {
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onUp);
			document.body.style.cursor = "";
			document.body.style.userSelect = "";
		};
		document.body.style.cursor = "row-resize";
		document.body.style.userSelect = "none";
		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
	};

	const stopwatch = useStopwatch(challengeStarted);
	const runMutation = useRunMutation(slug);
	const submitMutation = useSubmitMutation(slug);
	const formatMutation = useFormatMutation();
	const snapshotMutation = useCreateSnapshotMutation(slug);

	const problem = query.data;
	const defaultLang = useMemo(
		(): string =>
			problem ? (pickDefaultSnippet(problem.codeSnippets)?.langSlug ?? "") : "",
		[problem]
	);

	if (query.isLoading) {
		return (
			<div className="flex h-screen items-center justify-center text-gray-400 dark:text-gray-500">
				Loading problem…
			</div>
		);
	}
	if (query.isError || !problem) {
		return (
			<div className="flex h-screen flex-col items-center justify-center gap-2 text-center">
				<p className="text-red-600 dark:text-red-400">
					{query.error?.message ?? "Failed to load problem."}
				</p>
				<a
					className="text-base text-blue-600 underline dark:text-blue-400"
					href="/"
				>
					Back to problems
				</a>
			</div>
		);
	}

	const lang = selectedLang ?? defaultLang;
	const snippetCode =
		problem.codeSnippets.find((s) => s.langSlug === lang)?.code ?? "";
	const currentCode = codeByLang[lang] ?? snippetCode;

	const onLangChange = (next: string): void => {
		setSelectedLang(next);
	};

	const onCodeChange = (value: string): void => {
		setCodeByLang((previous) => ({ ...previous, [lang]: value }));
	};

	/** Repopulate the editor with a past submission to revise it. */
	const onLoadCode = (entryLang: string, entryCode: string): void => {
		setSelectedLang(entryLang);
		setCodeByLang((previous) => ({ ...previous, [entryLang]: entryCode }));
	};

	const busy = runMutation.isPending || submitMutation.isPending;
	const canAct =
		challengeStarted && !busy && lang.length > 0 && currentCode.trim().length > 0;
	const canFormat = canAct && !formatMutation.isPending;
	const canSnapshot =
		!snapshotMutation.isPending && lang.length > 0 && currentCode.trim().length > 0;

	const onRun = (): void => {
		if (!canAct) return;
		setLastAction("run");
		setBottomTab("console");
		runMutation.mutate({ lang, code: currentCode });
	};
	const onSubmit = (): void => {
		if (!canAct) return;
		setLastAction("submit");
		setBottomTab("console");
		setSubmitElapsed(stopwatch.elapsedSeconds);
		const submittedCode = currentCode;
		submitMutation.mutate(
			{ lang, code: submittedCode },
			{
				// Feature 4: prompt for complexity once a submission is Accepted.
				onSuccess: (result) => {
					if (result.accepted) {
						setAcceptedCode(submittedCode);
						setComplexityOpen(true);
					}
				},
			}
		);
	};
	const onSnapshot = (): void => {
		if (!canSnapshot) return;
		snapshotMutation.reset(); // clear any stale error from a prior save
		setSaveOpen(true);
	};
	const onConfirmSave = (data: {
		name: string;
		note: string;
		code: string;
	}): void => {
		snapshotMutation.mutate(
			{
				slug,
				lang,
				code: data.code,
				name: data.name.trim() || undefined,
				note: data.note.trim() || undefined,
			},
			{
				onSuccess: () => {
					setSaveOpen(false);
					setBottomTab("history");
				},
			}
		);
	};
	const onFormat = (): void => {
		if (!canFormat) return;
		setFormatNotice(null);
		formatMutation.mutate(
			{ lang, code: currentCode },
			{
				onSuccess: (formatted) => {
					setCodeByLang((previous) => ({ ...previous, [lang]: formatted }));
				},
				onError: (error) => {
					setFormatNotice(error.message);
				},
			}
		);
	};

	const activeMutation =
		lastAction === "submit"
			? submitMutation
			: lastAction === "run"
				? runMutation
				: null;

	return (
		<div className="flex h-screen flex-col">
			<SaveAnswerDialog
				error={snapshotMutation.error?.message ?? null}
				initialCode={currentCode}
				lang={lang}
				open={saveOpen}
				saving={snapshotMutation.isPending}
				onClose={(): void => { setSaveOpen(false); }}
				onSave={onConfirmSave}
			/>
			<WorkspaceHeader
				busy={busy}
				canFormat={canFormat}
				canRun={canAct}
				canSnapshot={canSnapshot}
				canSubmit={canAct}
				challengeStarted={challengeStarted}
				difficulty={problem.difficulty}
				elapsed={stopwatch.formatted}
				formatting={formatMutation.isPending}
				frontendId={problem.questionFrontendId}
				langSlug={lang}
				snapshotting={snapshotMutation.isPending}
				snippets={problem.codeSnippets}
				title={problem.title}
				tutorOpen={tutorOpen}
				onFormat={onFormat}
				onLangChange={onLangChange}
				onRun={onRun}
				onSnapshot={onSnapshot}
				onSubmit={onSubmit}
				onToggleTutor={(): void => { setTutorOpen((open) => !open); }}
			/>

			<main className="flex min-h-0 flex-1">
				<section className="w-[42%] border-r border-gray-200 dark:border-gray-800">
					<ProblemPanel problem={problem} />
				</section>
				<section className="relative flex min-w-0 flex-1 flex-col">
					{complexityOpen && (
						<ComplexityModal
							code={acceptedCode}
							difficulty={problem.difficulty}
							elapsedSeconds={submitElapsed}
							lang={lang}
							slug={slug}
							onClose={(): void => { setComplexityOpen(false); }}
						/>
					)}
					{formatNotice && (
						<div className="flex items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-base text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
							<span>{formatNotice}</span>
							<button
								className="text-amber-500 hover:text-amber-700 dark:hover:text-amber-300"
								type="button"
								onClick={(): void => {
									setFormatNotice(null);
								}}
							>
								✕
							</button>
						</div>
					)}
					<div className="min-h-0 flex-1">
						<EditorPanel
							challengeStarted={challengeStarted}
							code={currentCode}
							fontFamily={fontFamily}
							fontSize={fontSize}
							langSlug={lang}
							onChange={onCodeChange}
							onFormat={onFormat}
							onStart={(): void => { setChallengeStarted(true); }}
						/>
					</div>
					{/* Splitter: drag to resize the console panel below. */}
					<div
						aria-orientation="horizontal"
						className="h-1.5 shrink-0 cursor-row-resize bg-gray-700 transition-colors hover:bg-blue-500"
						role="separator"
						onPointerDown={startConsoleResize}
					/>
					<div
						className="flex shrink-0 flex-col"
						style={{ height: `${consoleHeight.toString()}px` }}
					>
						<div className="flex shrink-0 gap-1 bg-gray-900 px-2 pt-2">
							{(["console", "history"] as const).map((tab) => (
								<button
									key={tab}
									type="button"
									className={`rounded-t-md px-3 py-1 text-xs font-semibold capitalize ${
										bottomTab === tab
											? "bg-gray-800 text-gray-100"
											: "text-gray-500 hover:text-gray-300"
									}`}
									onClick={(): void => { setBottomTab(tab); }}
								>
									{tab}
								</button>
							))}
						</div>
						<div className="min-h-0 flex-1">
							{bottomTab === "console" ? (
								<ResultsPanel
									error={activeMutation?.error?.message ?? null}
									pending={busy}
									result={activeMutation?.data ?? null}
								/>
							) : (
								<SubmissionHistoryPanel slug={slug} onLoadCode={onLoadCode} />
							)}
						</div>
					</div>
				</section>
				{tutorOpen && (
					<TutorPanel
						code={currentCode}
						lang={lang}
						slug={slug}
						onClose={(): void => { setTutorOpen(false); }}
					/>
				)}
			</main>
		</div>
	);
};

export const WorkspacePage = (): FunctionComponent => {
	const { slug } = useParams({ from: "/problems/$slug" });
	return <Workspace key={slug} slug={slug} />;
};

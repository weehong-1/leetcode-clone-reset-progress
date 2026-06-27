import { PaperAirplaneIcon, StopIcon, XMarkIcon } from "@heroicons/react/24/solid";
import { useEffect, useRef, useState } from "react";
import type { FunctionComponent } from "@/common/types";
import { useTutorChat } from "../queries";

interface TutorPanelProps {
	slug: string;
	/** Current editor language + buffer, sent as context with each turn. */
	lang: string;
	code: string;
	onClose: () => void;
}

/**
 * Feature 6: collapsible right-side chat with the AI interviewer/tutor. Holds
 * conversation state via `useTutorChat` and streams replies token-by-token.
 */
export const TutorPanel = ({
	slug,
	lang,
	code,
	onClose,
}: TutorPanelProps): FunctionComponent => {
	const { messages, streaming, error, send, stop } = useTutorChat(slug);
	const [draft, setDraft] = useState("");
	const scrollRef = useRef<HTMLDivElement>(null);

	// Keep the latest turn in view as tokens stream in.
	useEffect(() => {
		scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
	}, [messages]);

	const onSend = (): void => {
		if (draft.trim().length === 0 || streaming) return;
		send(draft, { lang, code });
		setDraft("");
	};

	return (
		<aside className="flex w-80 shrink-0 flex-col border-l border-gray-800 bg-gray-900">
			<header className="flex shrink-0 items-center justify-between border-b border-gray-800 px-4 py-2">
				<h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
					AI Tutor
				</h2>
				<button
					className="text-gray-500 hover:text-gray-300"
					title="Close tutor"
					type="button"
					onClick={onClose}
				>
					<XMarkIcon className="h-4 w-4" />
				</button>
			</header>

			<div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
				{messages.length === 0 && (
					<p className="text-base text-gray-500">
						Ask your interviewer for a hint, sanity-check an approach, or talk
						through the problem. They won't hand you the answer unless you ask.
					</p>
				)}

				{messages.map((message, index) => (
					<div
						key={index}
						className={
							message.role === "user" ? "flex justify-end" : "flex justify-start"
						}
					>
						<div
							className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-base ${
								message.role === "user"
									? "bg-blue-600 text-white"
									: "bg-gray-800 text-gray-200"
							}`}
						>
							{message.content || (streaming ? "…" : "")}
						</div>
					</div>
				))}

				{error && (
					<div className="rounded border border-red-500/40 bg-red-500/10 p-2 text-sm text-red-300">
						{error}
					</div>
				)}
			</div>

			<div className="shrink-0 border-t border-gray-800 p-3">
				<div className="flex items-end gap-2">
					<textarea
						className="min-h-[2.5rem] flex-1 resize-none rounded border border-gray-700 bg-gray-800 px-3 py-2 text-base text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none"
						placeholder="Ask the tutor…"
						rows={2}
						value={draft}
						onChange={(event): void => { setDraft(event.target.value); }}
						onKeyDown={(event): void => {
							if (event.key === "Enter" && !event.shiftKey) {
								event.preventDefault();
								onSend();
							}
						}}
					/>
					{streaming ? (
						<button
							className="rounded-lg bg-gray-700 p-2 text-gray-200 transition hover:bg-gray-600"
							title="Stop"
							type="button"
							onClick={stop}
						>
							<StopIcon className="h-5 w-5" />
						</button>
					) : (
						<button
							className="rounded-lg bg-green-500 p-2 text-white transition hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-50"
							disabled={draft.trim().length === 0}
							title="Send"
							type="button"
							onClick={onSend}
						>
							<PaperAirplaneIcon className="h-5 w-5" />
						</button>
					)}
				</div>
			</div>
		</aside>
	);
};

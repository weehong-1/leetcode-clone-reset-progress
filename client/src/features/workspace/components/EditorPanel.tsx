import Editor, { type OnMount } from "@monaco-editor/react";
import { type editor, KeyCode, KeyMod } from "monaco-editor";
import { useEffect, useRef } from "react";
import type { FunctionComponent } from "@/common/types";
import { useResolvedTheme } from "@/lib/theme";
import { toMonacoLanguage } from "../language";
import { StartChallengeOverlay } from "./StartChallengeOverlay";

interface EditorPanelProps {
	langSlug: string;
	code: string;
	onChange: (value: string) => void;
	challengeStarted: boolean;
	onStart: () => void;
	onFormat: () => void;
	fontFamily: string;
	fontSize: number;
}

export const EditorPanel = ({
	langSlug,
	code,
	onChange,
	challengeStarted,
	onStart,
	onFormat,
	fontFamily,
	fontSize,
}: EditorPanelProps): FunctionComponent => {
	const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
	const resolvedTheme = useResolvedTheme();

	// Keep the latest onFormat reachable from the Monaco command (registered
	// once on mount) without rebinding it on every render.
	const onFormatRef = useRef(onFormat);
	useEffect((): void => {
		onFormatRef.current = onFormat;
	}, [onFormat]);

	const handleMount: OnMount = (instance): void => {
		editorRef.current = instance;
		// Shift+Alt+F → server-side format (overrides Monaco's formatDocument).
		instance.addCommand(KeyMod.Shift | KeyMod.Alt | KeyCode.KeyF, (): void => {
			onFormatRef.current();
		});
	};

	// Monaco measures glyph widths once at creation. After a web font finishes
	// loading (or the user switches fonts), remeasure or glyphs misalign.
	// `remeasureFonts` is missing from the published editor type, so cast.
	useEffect((): (() => void) => {
		let cancelled = false;
		void (async (): Promise<void> => {
			try {
				await document.fonts.load(`${fontSize}px "${fontFamily}"`);
				await document.fonts.ready;
			} catch {
				/* font loading is best-effort */
			}
			const instance = editorRef.current as unknown as {
				remeasureFonts: () => void;
			} | null;
			if (!cancelled && instance) {
				instance.remeasureFonts();
			}
		})();
		return (): void => {
			cancelled = true;
		};
	}, [fontFamily, fontSize]);

	return (
		<div className="relative h-full w-full">
			<Editor
				language={toMonacoLanguage(langSlug)}
				path={langSlug}
				theme={resolvedTheme === "dark" ? "vs-dark" : "light"}
				value={code}
				loading={
					<span className="text-base text-gray-400 dark:text-gray-500">
						Loading editor…
					</span>
				}
				options={{
					readOnly: !challengeStarted,
					fontFamily,
					fontSize,
					automaticLayout: true,
					minimap: { enabled: false },
					scrollBeyondLastLine: false,
					tabSize: 4,
				}}
				onMount={handleMount}
				onChange={(value): void => {
					onChange(value ?? "");
				}}
			/>
			{!challengeStarted && <StartChallengeOverlay onStart={onStart} />}
		</div>
	);
};

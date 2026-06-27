import { useEffect } from "react";
import { useEditorPreferences } from "@/store/useEditorPreferences";

/**
 * Applies the editor font-size preference as the app-wide root font size.
 * Every rem-based Tailwind utility (text-*, spacing, sizing) scales from the
 * root, so one setting drives the whole UI — not just the Monaco editor.
 * Call once near the app root.
 */
export function useApplyFontSize(): void {
	const fontSize = useEditorPreferences((state) => state.fontSize);

	useEffect((): void => {
		document.documentElement.style.fontSize = `${fontSize}px`;
	}, [fontSize]);
}

import { create } from "zustand";
import { persist } from "zustand/middleware";

/** The five coding fonts loaded via Google Fonts in index.html. */
export const EDITOR_FONTS = [
	"Fira Code",
	"JetBrains Mono",
	"Source Code Pro",
	"Roboto Mono",
	"Inconsolata",
] as const;

export type EditorFont = (typeof EDITOR_FONTS)[number];

export const FONT_SIZES = [12, 13, 14, 16, 18, 20] as const;

interface EditorPreferencesState {
	fontFamily: EditorFont;
	fontSize: number;
	setFontFamily: (fontFamily: EditorFont) => void;
	setFontSize: (fontSize: number) => void;
}

/** Editor appearance preferences, persisted to localStorage across sessions. */
export const useEditorPreferences = create<EditorPreferencesState>()(
	persist(
		(set) => ({
			fontFamily: "Fira Code",
			fontSize: 14,
			setFontFamily: (fontFamily): void => {
				set({ fontFamily });
			},
			setFontSize: (fontSize): void => {
				set({ fontSize });
			},
		}),
		{ name: "editor-preferences" }
	)
);

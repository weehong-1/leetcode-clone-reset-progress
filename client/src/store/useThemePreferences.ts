import { create } from "zustand";
import { persist } from "zustand/middleware";

/** The three selectable theme modes. `system` follows the OS preference. */
export const THEME_MODES = ["light", "dark", "system"] as const;

export type ThemeMode = (typeof THEME_MODES)[number];

interface ThemePreferencesState {
	mode: ThemeMode;
	setMode: (mode: ThemeMode) => void;
}

/** Theme preference, persisted to localStorage across sessions. */
export const useThemePreferences = create<ThemePreferencesState>()(
	persist(
		(set) => ({
			mode: "system",
			setMode: (mode): void => {
				set({ mode });
			},
		}),
		{ name: "theme-preferences" }
	)
);

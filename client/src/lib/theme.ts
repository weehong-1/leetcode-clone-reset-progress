import { useEffect, useSyncExternalStore } from "react";
import {
	type ThemeMode,
	useThemePreferences,
} from "@/store/useThemePreferences";

export type ResolvedTheme = "light" | "dark";

const DARK_QUERY = "(prefers-color-scheme: dark)";

/** True when the OS currently prefers a dark color scheme. */
function systemPrefersDark(): boolean {
	return (
		typeof window !== "undefined" &&
		window.matchMedia(DARK_QUERY).matches
	);
}

/** Resolve a mode (which may be `system`) to a concrete light/dark theme. */
export function resolveTheme(mode: ThemeMode): ResolvedTheme {
	if (mode === "system") {
		return systemPrefersDark() ? "dark" : "light";
	}
	return mode;
}

/** Toggle the `dark` class on <html> to match the resolved theme. */
export function applyThemeClass(resolved: ResolvedTheme): void {
	document.documentElement.classList.toggle("dark", resolved === "dark");
}

/**
 * Applies the persisted theme to <html> and keeps it in sync — both when the
 * user changes the mode and (in `system` mode) when the OS preference flips.
 * Call once near the app root.
 */
export function useApplyTheme(): void {
	const mode = useThemePreferences((state) => state.mode);

	useEffect((): void | (() => void) => {
		applyThemeClass(resolveTheme(mode));

		if (mode !== "system") {
			return;
		}
		const media = window.matchMedia(DARK_QUERY);
		const onChange = (): void => {
			applyThemeClass(resolveTheme("system"));
		};
		media.addEventListener("change", onChange);
		return (): void => {
			media.removeEventListener("change", onChange);
		};
	}, [mode]);
}

/** Subscribe to OS color-scheme changes via `useSyncExternalStore`. */
function subscribeSystemDark(onChange: () => void): () => void {
	const media = window.matchMedia(DARK_QUERY);
	media.addEventListener("change", onChange);
	return (): void => {
		media.removeEventListener("change", onChange);
	};
}

/**
 * The effective light/dark theme for components that need it directly (e.g. to
 * pick a Monaco theme). Recomputes on mode change and on live OS changes.
 */
export function useResolvedTheme(): ResolvedTheme {
	const mode = useThemePreferences((state) => state.mode);
	const systemDark = useSyncExternalStore(
		subscribeSystemDark,
		systemPrefersDark,
		() => false
	);

	if (mode === "system") {
		return systemDark ? "dark" : "light";
	}
	return mode;
}

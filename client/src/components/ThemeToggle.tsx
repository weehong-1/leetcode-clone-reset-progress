import {
	ComputerDesktopIcon,
	MoonIcon,
	SunIcon,
} from "@heroicons/react/24/outline";
import type { ComponentType, SVGProps } from "react";
import type { FunctionComponent } from "@/common/types";
import {
	type ThemeMode,
	useThemePreferences,
} from "@/store/useThemePreferences";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

const OPTIONS: Array<{ mode: ThemeMode; label: string; Icon: IconComponent }> = [
	{ mode: "light", label: "Light", Icon: SunIcon },
	{ mode: "dark", label: "Dark", Icon: MoonIcon },
	{ mode: "system", label: "System", Icon: ComputerDesktopIcon },
];

interface ThemeToggleProps {
	/** Show text labels next to icons (default) or icons only. */
	showLabels?: boolean;
}

/** Three-way Light / Dark / System theme switch, backed by the theme store. */
export const ThemeToggle = ({
	showLabels = true,
}: ThemeToggleProps): FunctionComponent => {
	const mode = useThemePreferences((state) => state.mode);
	const setMode = useThemePreferences((state) => state.setMode);

	return (
		<div className="inline-flex gap-1 rounded-lg border border-gray-300 p-0.5 dark:border-gray-700">
			{OPTIONS.map((option) => {
				const active = option.mode === mode;
				const { Icon } = option;
				return (
					<button
						key={option.mode}
						aria-label={option.label}
						aria-pressed={active}
						title={option.label}
						type="button"
						className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-base ${
							active
								? "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
								: "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
						}`}
						onClick={(): void => { setMode(option.mode); }}
					>
						<Icon className="h-4 w-4" />
						{showLabels && option.label}
					</button>
				);
			})}
		</div>
	);
};

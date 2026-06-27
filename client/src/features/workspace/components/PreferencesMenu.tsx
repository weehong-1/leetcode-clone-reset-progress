import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import { Cog6ToothIcon } from "@heroicons/react/24/outline";
import type { FunctionComponent } from "@/common/types";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
	EDITOR_FONTS,
	FONT_SIZES,
	useEditorPreferences,
} from "@/store/useEditorPreferences";

/** Header dropdown to tune editor font family + size live (Feature 3). */
export const PreferencesMenu = (): FunctionComponent => {
	const fontFamily = useEditorPreferences((s) => s.fontFamily);
	const fontSize = useEditorPreferences((s) => s.fontSize);
	const setFontFamily = useEditorPreferences((s) => s.setFontFamily);
	const setFontSize = useEditorPreferences((s) => s.setFontSize);

	return (
		<Popover className="relative">
			<PopoverButton className="flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-base text-gray-700 hover:bg-gray-50 focus:outline-none dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
				<Cog6ToothIcon className="h-4 w-4" />
				Editor
			</PopoverButton>
			<PopoverPanel className="absolute right-0 z-20 mt-2 w-60 rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-900">
				<p className="mb-1 text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">
					Theme
				</p>
				<div className="mb-3">
					<ThemeToggle showLabels={false} />
				</div>

				<p className="mb-1 text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">
					Font
				</p>
				<div className="mb-3 flex flex-col gap-1">
					{EDITOR_FONTS.map((font) => (
						<button
							key={font}
							style={{ fontFamily: font }}
							type="button"
							className={`rounded px-2 py-1 text-left text-base ${
								font === fontFamily
									? "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
									: "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
							}`}
							onClick={(): void => { setFontFamily(font); }}
						>
							{font}
						</button>
					))}
				</div>

				<p className="mb-1 text-xs font-semibold uppercase text-gray-400 dark:text-gray-500">
					Size
				</p>
				<div className="flex flex-wrap gap-1.5">
					{FONT_SIZES.map((size) => (
						<button
							key={size}
							type="button"
							className={`rounded px-2.5 py-1 text-base ${
								size === fontSize
									? "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
									: "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
							}`}
							onClick={(): void => { setFontSize(size); }}
						>
							{size}
						</button>
					))}
				</div>
			</PopoverPanel>
		</Popover>
	);
};

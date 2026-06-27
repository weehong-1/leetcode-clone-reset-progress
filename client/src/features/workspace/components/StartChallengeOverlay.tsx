import { PlayIcon } from "@heroicons/react/24/solid";
import type { FunctionComponent } from "@/common/types";

/**
 * Covers the editor until the user commits to the attempt. Clicking "Start
 * Challenge" unlocks the editor and starts the stopwatch (Feature 2).
 */
export const StartChallengeOverlay = ({
	onStart,
}: {
	onStart: () => void;
}): FunctionComponent => {
	return (
		<div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-gray-900/70 backdrop-blur-sm">
			<p className="max-w-sm text-center text-base text-gray-200">
				The editor is locked. Start the challenge to begin coding — your timer
				starts now.
			</p>
			<button
				className="flex items-center gap-2 rounded-lg bg-green-500 px-6 py-3 text-base font-semibold text-white shadow-lg transition hover:bg-green-600"
				type="button"
				onClick={onStart}
			>
				<PlayIcon className="h-5 w-5" />
				Start Challenge
			</button>
		</div>
	);
};

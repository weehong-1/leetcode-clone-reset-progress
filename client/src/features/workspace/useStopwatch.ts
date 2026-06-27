import { useEffect, useState } from "react";

export interface Stopwatch {
	/** Whole seconds elapsed since the stopwatch started. */
	elapsedSeconds: number;
	/** "mm:ss" (or "h:mm:ss" past an hour) formatted elapsed time. */
	formatted: string;
}

function format(totalSeconds: number): string {
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	const mm = String(minutes).padStart(2, "0");
	const ss = String(seconds).padStart(2, "0");
	return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * Timestamp-based stopwatch. We store the start time and compute elapsed from
 * `Date.now()` on each tick (rather than incrementing a counter), so it stays
 * accurate across StrictMode double-invokes and background-tab throttling.
 *
 * Pass `running=false` to keep it at 0 until the challenge starts.
 */
export function useStopwatch(running: boolean): Stopwatch {
	const [elapsedSeconds, setElapsedSeconds] = useState(0);

	useEffect((): undefined | (() => void) => {
		if (!running) {
			return undefined;
		}
		const startedAt = Date.now();
		const id = setInterval((): void => {
			setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
		}, 250);
		return (): void => {
			clearInterval(id);
		};
	}, [running]);

	return { elapsedSeconds, formatted: format(elapsedSeconds) };
}

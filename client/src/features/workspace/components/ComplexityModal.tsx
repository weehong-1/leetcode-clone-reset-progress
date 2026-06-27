import { CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/solid";
import { useState } from "react";
import type { Difficulty, Sm2Grade } from "@shared";
import type { FunctionComponent } from "@/common/types";
import { useValidateComplexityMutation } from "../queries";

interface ComplexityModalProps {
	slug: string;
	lang: string;
	code: string;
	elapsedSeconds: number;
	difficulty: Difficulty;
	onClose: () => void;
}

/** Target solve times per difficulty (seconds) — ARCHITECTURE.md §5. */
const BENCHMARK_SECONDS: Record<Difficulty, number> = {
	Easy: 15 * 60,
	Medium: 30 * 60,
	Hard: 45 * 60,
};

/**
 * Derive the SM-2 recall grade from solve time vs. the difficulty benchmark.
 * The submission is already Accepted here, so the error grade (0) never applies
 * and the floor is 2.
 */
function deriveGrade(elapsedSeconds: number, difficulty: Difficulty): Sm2Grade {
	const benchmark = BENCHMARK_SECONDS[difficulty];
	if (elapsedSeconds <= benchmark) return 5;
	if (elapsedSeconds <= benchmark * 1.33) return 4;
	if (elapsedSeconds <= benchmark * 1.66) return 3;
	return 2;
}

function Verdict({
	label,
	guess,
	actual,
	correct,
}: {
	label: string;
	guess: string;
	actual: string;
	correct: boolean;
}): FunctionComponent {
	return (
		<div className="flex items-start gap-2">
			{correct ? (
				<CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-green-400" />
			) : (
				<XCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
			)}
			<div>
				<span className="font-semibold text-gray-100">{label}: </span>
				<span className="text-gray-300">
					you guessed <code className="text-gray-100">{guess || "—"}</code>
				</span>
				{!correct && (
					<span className="text-gray-300">
						{" "}
						· actual <code className="text-amber-300">{actual}</code>
					</span>
				)}
			</div>
		</div>
	);
}

/**
 * Feature 4: shown once a submission is Accepted. Collects the user's Big-O
 * guesses, validates them via the AI, and reveals the actual bounds plus the
 * derived SM-2 grade.
 */
export const ComplexityModal = ({
	slug,
	lang,
	code,
	elapsedSeconds,
	difficulty,
	onClose,
}: ComplexityModalProps): FunctionComponent => {
	const [estimatedTime, setEstimatedTime] = useState("");
	const [estimatedSpace, setEstimatedSpace] = useState("");
	const mutation = useValidateComplexityMutation();
	const grade = deriveGrade(elapsedSeconds, difficulty);

	const onValidate = (): void => {
		mutation.mutate({
			slug,
			lang,
			code,
			estimatedTime,
			estimatedSpace,
			elapsedSeconds,
		});
	};

	const result = mutation.data;

	return (
		<div className="absolute inset-0 z-20 flex items-center justify-center bg-gray-900/70 p-6 backdrop-blur-sm">
			<div className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-2xl">
				<div className="mb-1 flex items-center gap-2">
					<CheckCircleIcon className="h-6 w-6 text-green-400" />
					<h2 className="text-lg font-semibold text-gray-100">Accepted!</h2>
				</div>
				<p className="mb-4 text-base text-gray-400">
					Before you move on — what complexity do you think your solution has?
				</p>

				{!result && (
					<div className="space-y-3">
						<label className="block">
							<span className="mb-1 block text-sm text-gray-400">
								Time complexity
							</span>
							<input
								autoFocus
								className="w-full rounded border border-gray-700 bg-gray-900 px-3 py-2 text-base text-gray-100 placeholder-gray-600 focus:border-blue-500 focus:outline-none"
								placeholder="e.g. O(n log n)"
								value={estimatedTime}
								onChange={(event): void => { setEstimatedTime(event.target.value); }}
							/>
						</label>
						<label className="block">
							<span className="mb-1 block text-sm text-gray-400">
								Space complexity
							</span>
							<input
								className="w-full rounded border border-gray-700 bg-gray-900 px-3 py-2 text-base text-gray-100 placeholder-gray-600 focus:border-blue-500 focus:outline-none"
								placeholder="e.g. O(n)"
								value={estimatedSpace}
								onChange={(event): void => { setEstimatedSpace(event.target.value); }}
							/>
						</label>

						{mutation.isError && (
							<p className="text-sm text-red-400">{mutation.error.message}</p>
						)}

						<div className="flex justify-end gap-2 pt-1">
							<button
								className="rounded-lg border border-gray-600 px-4 py-2 text-base text-gray-300 transition hover:bg-gray-700"
								type="button"
								onClick={onClose}
							>
								Skip / I don't know
							</button>
							<button
								className="rounded-lg bg-green-500 px-4 py-2 text-base font-semibold text-white transition hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-50"
								disabled={mutation.isPending}
								type="button"
								onClick={onValidate}
							>
								{mutation.isPending ? "Analyzing…" : "Validate"}
							</button>
						</div>
					</div>
				)}

				{result && (
					<div className="space-y-4">
						<div className="space-y-2 rounded-lg border border-gray-700 bg-gray-900/60 p-3 text-base">
							<Verdict
								actual={result.actualTime}
								correct={result.timeCorrect}
								guess={estimatedTime}
								label="Time"
							/>
							<Verdict
								actual={result.actualSpace}
								correct={result.spaceCorrect}
								guess={estimatedSpace}
								label="Space"
							/>
						</div>

						<p className="text-base leading-relaxed text-gray-300">
							{result.explanation}
						</p>

						<p className="text-sm text-gray-500">
							Recall grade for spaced repetition:{" "}
							<span className="font-semibold text-gray-300">{grade}/5</span>{" "}
							(solved in {Math.floor(elapsedSeconds / 60)}m
							{String(elapsedSeconds % 60).padStart(2, "0")}s,{" "}
							{difficulty} target {BENCHMARK_SECONDS[difficulty] / 60}m)
						</p>

						<div className="flex justify-end">
							<button
								className="rounded-lg bg-green-500 px-4 py-2 text-base font-semibold text-white transition hover:bg-green-600"
								type="button"
								onClick={onClose}
							>
								Done
							</button>
						</div>
					</div>
				)}
			</div>
		</div>
	);
};

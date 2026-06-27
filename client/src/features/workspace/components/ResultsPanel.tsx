import type { JudgeResult } from "@shared";
import type { FunctionComponent } from "@/common/types";

interface ResultsPanelProps {
	pending: boolean;
	error: string | null;
	result: JudgeResult | null;
}

function Row({
	label,
	value,
}: {
	label: string;
	value: string;
}): FunctionComponent {
	return (
		<div className="flex gap-2">
			<span className="w-32 shrink-0 text-gray-400">{label}</span>
			<span className="font-mono text-gray-200">{value}</span>
		</div>
	);
}

export const ResultsPanel = ({
	pending,
	error,
	result,
}: ResultsPanelProps): FunctionComponent => {
	return (
		<div className="h-full overflow-y-auto bg-gray-900 p-4 text-base text-gray-200">
			<h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
				Console
			</h2>

			{pending && (
				<p className="text-amber-300">
					Judging… waiting for the LeetCode verdict (this can take a few
					seconds).
				</p>
			)}

			{!pending && error && (
				<div className="rounded border border-red-500/40 bg-red-500/10 p-3 text-red-300">
					{error}
				</div>
			)}

			{!pending && !error && !result && (
				<p className="text-gray-500">Run or submit your code to see results.</p>
			)}

			{!pending && !error && result && (
				<div className="space-y-2">
					<p
						className={`text-base font-semibold ${
							result.accepted ? "text-green-400" : "text-red-400"
						}`}
					>
						{result.statusMsg}
					</p>

					{result.totalTestcases !== null && (
						<Row
							label="Test cases"
							value={`${result.totalCorrect ?? 0} / ${result.totalTestcases}`}
						/>
					)}
					{result.runtime && <Row label="Runtime" value={result.runtime} />}
					{result.memory && <Row label="Memory" value={result.memory} />}

					{result.compileError && (
						<pre className="whitespace-pre-wrap rounded bg-red-500/10 p-3 text-red-300">
							{result.compileError}
						</pre>
					)}
					{result.runtimeError && (
						<pre className="whitespace-pre-wrap rounded bg-red-500/10 p-3 text-red-300">
							{result.runtimeError}
						</pre>
					)}

					{result.codeAnswer && result.codeAnswer.length > 0 && (
						<div className="pt-2">
							<p className="mb-1 text-gray-400">Output</p>
							<pre className="whitespace-pre-wrap rounded bg-gray-800 p-3">
								{result.codeAnswer.join("\n")}
							</pre>
						</div>
					)}
					{result.expectedCodeAnswer && result.expectedCodeAnswer.length > 0 && (
						<div>
							<p className="mb-1 text-gray-400">Expected</p>
							<pre className="whitespace-pre-wrap rounded bg-gray-800 p-3">
								{result.expectedCodeAnswer.join("\n")}
							</pre>
						</div>
					)}

					{result.lastTestcase && (
						<div>
							<p className="mb-1 text-gray-400">Last test case</p>
							<pre className="whitespace-pre-wrap rounded bg-gray-800 p-3">
								{result.lastTestcase}
							</pre>
						</div>
					)}
				</div>
			)}
		</div>
	);
};

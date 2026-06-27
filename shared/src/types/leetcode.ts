/**
 * Contracts for the LeetCode proxy, shared between client and server.
 * Type-only (see shared/README.md).
 */
import type { Difficulty } from "./problem";

/** A starter-code stub for one language, as returned by LeetCode. */
export interface CodeSnippet {
	lang: string;
	langSlug: string;
	code: string;
}

/** Normalized problem detail surfaced by `GET /api/leetcode/problems/:slug`. */
export interface LeetCodeProblem {
	questionId: string;
	questionFrontendId: string;
	title: string;
	titleSlug: string;
	difficulty: Difficulty;
	/** HTML problem statement. */
	content: string;
	topicTags: Array<string>;
	codeSnippets: Array<CodeSnippet>;
	/** Newline-delimited example test cases ("Run Code" default input). */
	exampleTestcases: string;
	sampleTestCase: string;
	hints: Array<string>;
}

/** One row in the problem-set list (`GET /api/leetcode/problems`). */
export interface LeetCodeProblemSummary {
	questionFrontendId: string;
	title: string;
	titleSlug: string;
	difficulty: Difficulty;
	/** Premium problem — opening requires LeetCode auth and may not be crawlable. */
	paidOnly: boolean;
	/** Acceptance rate as a percentage, as LeetCode returns it. */
	acRate: number;
	/** Topic tag names, e.g. ["Array", "Hash Table"]. */
	topicTags: Array<string>;
}

/** Paginated problem-set listing surfaced by `GET /api/leetcode/problems`. */
export interface ProblemListResult {
	/** Total problems matching the active filter (drives pagination). */
	total: number;
	questions: Array<LeetCodeProblemSummary>;
}

/** LeetCode judge lifecycle state from the check endpoint. */
export type JudgeState = "PENDING" | "STARTED" | "SUCCESS" | "FAILURE";

/**
 * Normalized result of a Run or Submit, after the backend has polled the judge
 * to completion. Run-only fields (`codeAnswer`, `expectedCodeAnswer`) are null
 * for submissions.
 */
export interface JudgeResult {
	/** The `submission_id` (submit) or `interpret_id` (run). */
	submissionId: string;
	state: JudgeState;
	/** e.g. "Accepted", "Wrong Answer", "Time Limit Exceeded". */
	statusMsg: string;
	accepted: boolean;

	totalCorrect: number | null;
	totalTestcases: number | null;

	runtime: string | null;
	runtimeMs: number | null;
	memory: string | null;
	memoryKb: number | null;

	// Run-mode (interpret_solution) extras
	codeAnswer: Array<string> | null;
	expectedCodeAnswer: Array<string> | null;

	// Error channels
	compileError: string | null;
	runtimeError: string | null;
	lastTestcase: string | null;
}

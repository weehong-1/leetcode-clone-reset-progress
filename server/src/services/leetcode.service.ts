import type {
	CodeSnippet,
	Difficulty,
	JudgeResult,
	JudgeState,
	LeetCodeProblem,
	LeetCodeProblemSummary,
	ProblemListResult,
} from "@shared";
import { getEffectiveSettings } from "./settings.service";
import { saveJudgedSubmission } from "./submissions.service";

const LEETCODE_BASE = "https://leetcode.com";
const USER_AGENT =
	"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) " +
	"Chrome/124.0.0.0 Safari/537.36";

// Placeholder values shipped in `.env.example`; treated as "no auth configured".
const PLACEHOLDERS = new Set([
	"",
	"your_session_cookie_here",
	"your_csrf_token_here",
]);

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 60_000;

/** Error carrying an HTTP status for the controller to map onto the response. */
export class LeetCodeError extends Error {
	public readonly statusCode: number;

	public constructor(message: string, statusCode = 502) {
		super(message);
		this.name = "LeetCodeError";
		this.statusCode = statusCode;
	}
}

/**
 * Resolve the effective LeetCode credentials (Settings DB over env) and whether
 * they look real. Read at call time so a session saved in the Settings UI takes
 * effect without a restart.
 */
async function getLeetCodeAuth(): Promise<{
	session: string;
	csrf: string;
	hasAuth: boolean;
}> {
	const settings = await getEffectiveSettings();
	const hasAuth =
		!PLACEHOLDERS.has(settings.leetcodeSession) &&
		!PLACEHOLDERS.has(settings.csrfToken);
	return { session: settings.leetcodeSession, csrf: settings.csrfToken, hasAuth };
}

/** True when real LeetCode session credentials are configured. */
export async function hasLeetCodeAuth(): Promise<boolean> {
	return (await getLeetCodeAuth()).hasAuth;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Headers for authenticated REST calls (run/submit/check). */
async function authHeaders(slug: string): Promise<Record<string, string>> {
	const { session, csrf } = await getLeetCodeAuth();
	return {
		"Content-Type": "application/json",
		"User-Agent": USER_AGENT,
		Origin: LEETCODE_BASE,
		Referer: `${LEETCODE_BASE}/problems/${slug}/`,
		"x-csrftoken": csrf,
		Cookie: `LEETCODE_SESSION=${session}; csrftoken=${csrf}`,
	};
}

async function requireAuth(): Promise<void> {
	if (!(await hasLeetCodeAuth())) {
		throw new LeetCodeError(
			"LeetCode credentials are not configured. Add your LEETCODE_SESSION " +
				"and csrftoken in Settings to run or submit code.",
			503
		);
	}
}

interface GraphQLResponse<T> {
	data?: T;
	errors?: { message: string }[];
}

async function graphql<T>(
	query: string,
	variables: Record<string, unknown>
): Promise<T> {
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
		"User-Agent": USER_AGENT,
		Referer: LEETCODE_BASE,
	};
	// Public problem data does not require auth; include cookies only if real.
	const auth = await getLeetCodeAuth();
	if (auth.hasAuth) {
		headers["Cookie"] = `LEETCODE_SESSION=${auth.session}; csrftoken=${auth.csrf}`;
		headers["x-csrftoken"] = auth.csrf;
	}

	let response: Response;
	try {
		response = await fetch(`${LEETCODE_BASE}/graphql`, {
			method: "POST",
			headers,
			body: JSON.stringify({ query, variables }),
		});
	} catch (cause) {
		throw new LeetCodeError(`Failed to reach LeetCode: ${String(cause)}`, 502);
	}

	if (!response.ok) {
		throw new LeetCodeError(
			`LeetCode GraphQL responded ${response.status}`,
			response.status === 404 ? 404 : 502
		);
	}

	const body = (await response.json()) as GraphQLResponse<T>;
	if (body.errors && body.errors.length > 0) {
		throw new LeetCodeError(body.errors.map((e) => e.message).join("; "), 502);
	}
	if (!body.data) {
		throw new LeetCodeError("LeetCode GraphQL returned no data", 502);
	}
	return body.data;
}

const QUESTION_QUERY = `
	query questionData($titleSlug: String!) {
		question(titleSlug: $titleSlug) {
			questionId
			questionFrontendId
			title
			titleSlug
			content
			difficulty
			exampleTestcases
			sampleTestCase
			hints
			topicTags { name }
			codeSnippets { lang langSlug code }
		}
	}
`;

interface RawQuestion {
	questionId: string;
	questionFrontendId: string;
	title: string;
	titleSlug: string;
	content: string | null;
	difficulty: Difficulty;
	exampleTestcases: string | null;
	sampleTestCase: string | null;
	hints: string[];
	topicTags: { name: string }[];
	codeSnippets: CodeSnippet[];
}

/** Fetch normalized problem detail by slug via the public GraphQL endpoint. */
export async function getProblem(slug: string): Promise<LeetCodeProblem> {
	const data = await graphql<{ question: RawQuestion | null }>(QUESTION_QUERY, {
		titleSlug: slug,
	});
	const q = data.question;
	if (!q) {
		throw new LeetCodeError(`Problem not found: ${slug}`, 404);
	}

	return {
		questionId: q.questionId,
		questionFrontendId: q.questionFrontendId,
		title: q.title,
		titleSlug: q.titleSlug,
		difficulty: q.difficulty,
		content: q.content ?? "",
		topicTags: q.topicTags.map((tag) => tag.name),
		codeSnippets: q.codeSnippets,
		exampleTestcases: q.exampleTestcases ?? "",
		sampleTestCase: q.sampleTestCase ?? "",
		hints: q.hints,
	};
}

const LIST_QUERY = `
	query problemsetQuestionList(
		$categorySlug: String
		$limit: Int
		$skip: Int
		$filters: QuestionListFilterInput
	) {
		problemsetQuestionList: questionList(
			categorySlug: $categorySlug
			limit: $limit
			skip: $skip
			filters: $filters
		) {
			total: totalNum
			questions: data {
				frontendQuestionId: questionFrontendId
				title
				titleSlug
				difficulty
				paidOnly: isPaidOnly
				acRate
				topicTags { name }
			}
		}
	}
`;

interface RawListQuestion {
	frontendQuestionId: string;
	title: string;
	titleSlug: string;
	difficulty: Difficulty;
	paidOnly: boolean;
	acRate: number;
	topicTags: { name: string }[];
}

interface RawList {
	problemsetQuestionList: {
		total: number;
		questions: RawListQuestion[];
	} | null;
}

export interface ProblemListInput {
	limit: number;
	skip: number;
	difficulty?: Difficulty;
	search?: string;
	tags?: string[];
}

/** Fetch a paginated, filtered slice of the public problem set. */
export async function getProblemList(
	input: ProblemListInput
): Promise<ProblemListResult> {
	const filters: Record<string, unknown> = {};
	if (input.difficulty) {
		filters["difficulty"] = input.difficulty.toUpperCase();
	}
	if (input.search) {
		filters["searchKeywords"] = input.search;
	}
	if (input.tags && input.tags.length > 0) {
		filters["tags"] = input.tags;
	}

	const data = await graphql<RawList>(LIST_QUERY, {
		categorySlug: "",
		limit: input.limit,
		skip: input.skip,
		filters,
	});

	const list = data.problemsetQuestionList;
	if (!list) {
		throw new LeetCodeError("LeetCode returned no problem list", 502);
	}

	const questions: LeetCodeProblemSummary[] = list.questions.map((q) => ({
		questionFrontendId: q.frontendQuestionId,
		title: q.title,
		titleSlug: q.titleSlug,
		difficulty: q.difficulty,
		paidOnly: q.paidOnly,
		acRate: q.acRate,
		topicTags: q.topicTags.map((tag) => tag.name),
	}));

	return { total: list.total, questions };
}

async function postJson(
	path: string,
	slug: string,
	payload: Record<string, unknown>
): Promise<unknown> {
	let response: Response;
	try {
		response = await fetch(`${LEETCODE_BASE}${path}`, {
			method: "POST",
			headers: await authHeaders(slug),
			body: JSON.stringify(payload),
		});
	} catch (cause) {
		throw new LeetCodeError(`Failed to reach LeetCode: ${String(cause)}`, 502);
	}

	if (response.status === 403) {
		throw new LeetCodeError(
			"LeetCode rejected the request (403). Your session cookie is likely " +
				"expired — refresh LEETCODE_SESSION and CSRF_TOKEN.",
			403
		);
	}
	if (!response.ok) {
		throw new LeetCodeError(`LeetCode responded ${response.status}`, 502);
	}
	return response.json();
}

function parseRuntimeMs(runtime: string | null | undefined): number | null {
	if (!runtime) return null;
	const match = /([\d.]+)\s*ms/.exec(runtime);
	return match?.[1] ? Number.parseFloat(match[1]) : null;
}

function parseMemoryKb(memory: string | null | undefined): number | null {
	if (!memory) return null;
	const match = /([\d.]+)\s*(KB|MB|GB)/i.exec(memory);
	if (!match?.[1] || !match[2]) return null;
	const value = Number.parseFloat(match[1]);
	const unit = match[2].toUpperCase();
	const factor = unit === "GB" ? 1024 * 1024 : unit === "MB" ? 1024 : 1;
	return Math.round(value * factor);
}

interface RawCheckResult {
	state: JudgeState;
	status_msg?: string;
	status_runtime?: string;
	status_memory?: string;
	total_correct?: number;
	total_testcases?: number;
	code_answer?: string[];
	expected_code_answer?: string[];
	compile_error?: string;
	full_compile_error?: string;
	runtime_error?: string;
	last_testcase?: string;
}

/** One poll of the judge for a run/submit id. */
export async function checkSubmission(id: string): Promise<RawCheckResult> {
	let response: Response;
	try {
		response = await fetch(
			`${LEETCODE_BASE}/submissions/detail/${id}/check/`,
			{ headers: await authHeaders("") }
		);
	} catch (cause) {
		throw new LeetCodeError(`Failed to reach LeetCode: ${String(cause)}`, 502);
	}
	if (!response.ok) {
		throw new LeetCodeError(
			`LeetCode check responded ${response.status}`,
			502
		);
	}
	return (await response.json()) as RawCheckResult;
}

/** Poll the judge every 1.5s until it leaves PENDING/STARTED (or times out). */
async function pollUntilDone(id: string): Promise<RawCheckResult> {
	const deadline = Date.now() + POLL_TIMEOUT_MS;
	for (;;) {
		const result = await checkSubmission(id);
		if (result.state !== "PENDING" && result.state !== "STARTED") {
			return result;
		}
		if (Date.now() >= deadline) {
			throw new LeetCodeError(
				`Timed out waiting for LeetCode judge on ${id}`,
				504
			);
		}
		await sleep(POLL_INTERVAL_MS);
	}
}

function toJudgeResult(id: string, raw: RawCheckResult): JudgeResult {
	const statusMsg = raw.status_msg ?? "Unknown";
	return {
		submissionId: id,
		state: raw.state,
		statusMsg,
		accepted: statusMsg === "Accepted",
		totalCorrect: raw.total_correct ?? null,
		totalTestcases: raw.total_testcases ?? null,
		runtime: raw.status_runtime ?? null,
		runtimeMs: parseRuntimeMs(raw.status_runtime),
		memory: raw.status_memory ?? null,
		memoryKb: parseMemoryKb(raw.status_memory),
		codeAnswer: raw.code_answer ?? null,
		expectedCodeAnswer: raw.expected_code_answer ?? null,
		compileError: raw.full_compile_error ?? raw.compile_error ?? null,
		runtimeError: raw.runtime_error ?? null,
		lastTestcase: raw.last_testcase ?? null,
	};
}

export interface RunInput {
	slug: string;
	lang: string;
	code: string;
	/** Test input; defaults to the problem's example test cases. */
	dataInput?: string;
}

export interface SubmitInput {
	slug: string;
	lang: string;
	code: string;
}

/** Run code against example test cases (interpret_solution) and await the result. */
export async function runCode(input: RunInput): Promise<JudgeResult> {
	await requireAuth();
	const problem = await getProblem(input.slug);
	const dataInput = input.dataInput ?? problem.exampleTestcases;

	const raw = (await postJson(
		`/problems/${input.slug}/interpret_solution/`,
		input.slug,
		{
			lang: input.lang,
			question_id: problem.questionId,
			typed_code: input.code,
			data_input: dataInput,
		}
	)) as { interpret_id?: string };

	if (!raw.interpret_id) {
		throw new LeetCodeError("LeetCode did not return an interpret_id", 502);
	}
	const result = await pollUntilDone(raw.interpret_id);
	return toJudgeResult(raw.interpret_id, result);
}

/** Submit code against all test cases and await the judged result. */
export async function submitCode(input: SubmitInput): Promise<JudgeResult> {
	await requireAuth();
	const problem = await getProblem(input.slug);

	const raw = (await postJson(`/problems/${input.slug}/submit/`, input.slug, {
		lang: input.lang,
		question_id: problem.questionId,
		typed_code: input.code,
	})) as { submission_id?: number | string };

	if (raw.submission_id === undefined) {
		throw new LeetCodeError("LeetCode did not return a submission_id", 502);
	}
	const id = String(raw.submission_id);
	const result = await pollUntilDone(id);
	const judged = toJudgeResult(id, result);

	// Best-effort history persistence; never blocks/breaks the submit response.
	await saveJudgedSubmission({
		slug: input.slug,
		lang: input.lang,
		code: input.code,
		result: judged,
	});

	return judged;
}

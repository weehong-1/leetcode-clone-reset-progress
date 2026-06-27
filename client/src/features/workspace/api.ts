import type {
	ComplexityValidationResult,
	CreateSnapshotBody,
	FormatResult,
	JudgeResult,
	LeetCodeProblem,
	ProblemListResult,
	Submission,
	TutorChatBody,
	UpdateSubmissionBody,
	ValidateComplexityBody,
} from "@shared";
import { apiFetch } from "@/services/api";

export function fetchProblem(
	slug: string,
	refresh = false
): Promise<LeetCodeProblem> {
	// `refresh=true` makes the server bypass its MongoDB cache and re-fetch the
	// question live from LeetCode, overwriting the stored copy.
	const query = refresh ? "?refresh=true" : "";
	return apiFetch<LeetCodeProblem>(`/leetcode/problems/${slug}${query}`);
}

export interface ProblemListParameters {
	limit: number;
	skip: number;
	difficulty?: "Easy" | "Medium" | "Hard";
	search?: string;
	/** Topic-tag slugs. */
	tags?: Array<string>;
}

export function fetchProblemList(
	parameters: ProblemListParameters
): Promise<ProblemListResult> {
	const query = new URLSearchParams();
	query.set("limit", String(parameters.limit));
	query.set("skip", String(parameters.skip));
	if (parameters.difficulty) query.set("difficulty", parameters.difficulty);
	if (parameters.search) query.set("search", parameters.search);
	if (parameters.tags && parameters.tags.length > 0) {
		query.set("tags", parameters.tags.join(","));
	}
	return apiFetch<ProblemListResult>(`/leetcode/problems?${query.toString()}`);
}

export interface RunBody {
	lang: string;
	code: string;
	dataInput?: string;
}

export function runCode(slug: string, body: RunBody): Promise<JudgeResult> {
	return apiFetch<JudgeResult>(`/leetcode/problems/${slug}/run`, {
		method: "POST",
		body: JSON.stringify(body),
	});
}

export interface SubmitBody {
	lang: string;
	code: string;
}

export function submitCode(
	slug: string,
	body: SubmitBody
): Promise<JudgeResult> {
	return apiFetch<JudgeResult>(`/leetcode/problems/${slug}/submit`, {
		method: "POST",
		body: JSON.stringify(body),
	});
}

export interface FormatBody {
	lang: string;
	code: string;
}

export async function formatCode(body: FormatBody): Promise<string> {
	const result = await apiFetch<FormatResult>("/format", {
		method: "POST",
		body: JSON.stringify(body),
	});
	return result.formatted;
}

export function fetchSubmissions(slug: string): Promise<Array<Submission>> {
	return apiFetch<Array<Submission>>(
		`/submissions?slug=${encodeURIComponent(slug)}`
	);
}

export function createSnapshot(
	body: CreateSnapshotBody
): Promise<Submission> {
	return apiFetch<Submission>("/submissions", {
		method: "POST",
		body: JSON.stringify(body),
	});
}

export function updateSubmission(
	id: string,
	body: UpdateSubmissionBody
): Promise<Submission> {
	return apiFetch<Submission>(`/submissions/${id}`, {
		method: "PATCH",
		body: JSON.stringify(body),
	});
}

export function deleteSubmission(id: string): Promise<{ id: string }> {
	return apiFetch<{ id: string }>(`/submissions/${id}`, { method: "DELETE" });
}

// --- AI assistant ----------------------------------------------------------

/** Feature 4: validate the user's complexity guesses against the AI's analysis. */
export function validateComplexity(
	body: ValidateComplexityBody
): Promise<ComplexityValidationResult> {
	return apiFetch<ComplexityValidationResult>("/ai/validate-complexity", {
		method: "POST",
		body: JSON.stringify(body),
	});
}

export interface StreamTutorChatHandlers {
	/** Called for each streamed content delta. */
	onToken: (token: string) => void;
	/** Aborts the in-flight request when the user stops or navigates away. */
	signal?: AbortSignal;
}

/**
 * Feature 6: stream the tutor reply over SSE. Bypasses `apiFetch` (which expects
 * a single JSON envelope) and instead reads the response body incrementally,
 * parsing `data:` events of shape `{ token } | { done } | { error }`.
 */
export async function streamTutorChat(
	body: TutorChatBody,
	{ onToken, signal }: StreamTutorChatHandlers
): Promise<void> {
	const response = await fetch("/api/ai/chat", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
		signal,
	});

	// A validation/config failure arrives as the normal JSON error envelope.
	if (!response.ok || !response.body) {
		let message = `Request failed (${response.status})`;
		try {
			const payload = (await response.json()) as { error?: string };
			if (payload.error) message = payload.error;
		} catch {
			/* keep the status-based message */
		}
		throw new Error(message);
	}

	const decoder = new TextDecoder();
	let buffer = "";

	// SSE frames are separated by a blank line; tokens may split across reads.
	// `response.body` is an async-iterable byte stream in the browser.
	const stream = response.body as unknown as AsyncIterable<Uint8Array>;
	for await (const chunk of stream) {
		buffer += decoder.decode(chunk, { stream: true });

		let boundary = buffer.indexOf("\n\n");
		while (boundary !== -1) {
			const frame = buffer.slice(0, boundary);
			buffer = buffer.slice(boundary + 2);
			boundary = buffer.indexOf("\n\n");

			const line = frame.split("\n").find((l) => l.startsWith("data:"));
			if (!line) continue;
			const payload = JSON.parse(line.slice(5).trim()) as {
				token?: string;
				done?: boolean;
				error?: string;
			};
			if (payload.error) throw new Error(payload.error);
			if (payload.done) return;
			if (payload.token) onToken(payload.token);
		}
	}
}

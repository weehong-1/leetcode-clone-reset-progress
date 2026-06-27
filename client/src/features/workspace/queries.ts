import {
	useMutation,
	type UseMutationResult,
	useQuery,
	useQueryClient,
	type UseQueryResult,
} from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import type {
	ChatMessage,
	ComplexityValidationResult,
	CreateSnapshotBody,
	JudgeResult,
	LeetCodeProblem,
	ProblemListResult,
	Submission,
	UpdateSubmissionBody,
	ValidateComplexityBody,
} from "@shared";
import {
	createSnapshot,
	deleteSubmission,
	fetchProblem,
	fetchProblemList,
	type ProblemListParameters,
	fetchSubmissions,
	formatCode,
	type FormatBody,
	runCode,
	type RunBody,
	streamTutorChat,
	submitCode,
	type SubmitBody,
	updateSubmission,
	validateComplexity,
} from "./api";

/** Problem detail. Problems are effectively static, so cache aggressively. */
export function useProblemQuery(
	slug: string
): UseQueryResult<LeetCodeProblem, Error> {
	return useQuery({
		queryKey: ["problem", slug],
		queryFn: () => fetchProblem(slug),
		staleTime: 1000 * 60 * 60,
		retry: false,
	});
}

/**
 * Force a live re-fetch of the problem from LeetCode (bypassing the server's
 * MongoDB cache) and replace the cached query data with the fresh copy.
 */
export function useRefreshProblemMutation(
	slug: string
): UseMutationResult<LeetCodeProblem, Error, void> {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: () => fetchProblem(slug, true),
		retry: false,
		onSuccess: (fresh) => {
			queryClient.setQueryData(["problem", slug], fresh);
		},
	});
}

/** Paginated, filtered problem-set listing. Keeps prior page while refetching. */
export function useProblemListQuery(
	parameters: ProblemListParameters
): UseQueryResult<ProblemListResult, Error> {
	return useQuery({
		queryKey: ["problems", parameters],
		queryFn: () => fetchProblemList(parameters),
		staleTime: 1000 * 60 * 5,
		placeholderData: (previous) => previous,
		retry: false,
	});
}

/** Run against example test cases. Never retried (judge call blocks ~60s). */
export function useRunMutation(
	slug: string
): UseMutationResult<JudgeResult, Error, RunBody> {
	return useMutation({
		mutationFn: (body: RunBody) => runCode(slug, body),
		retry: false,
	});
}

/** Submit against all test cases. Never retried. Refreshes history on success. */
export function useSubmitMutation(
	slug: string
): UseMutationResult<JudgeResult, Error, SubmitBody> {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (body: SubmitBody) => submitCode(slug, body),
		retry: false,
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["submissions", slug] });
		},
	});
}

/** A problem's submission history (judged submits + manual snapshots). */
export function useSubmissionsQuery(
	slug: string
): UseQueryResult<Array<Submission>, Error> {
	return useQuery({
		queryKey: ["submissions", slug],
		queryFn: () => fetchSubmissions(slug),
		retry: false,
	});
}

/** Save the current editor code as a named snapshot. */
export function useCreateSnapshotMutation(
	slug: string
): UseMutationResult<Submission, Error, CreateSnapshotBody> {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (body: CreateSnapshotBody) => createSnapshot(body),
		retry: false,
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["submissions", slug] });
		},
	});
}

/** Edit a history entry's name/note. */
export function useUpdateSubmissionMutation(
	slug: string
): UseMutationResult<Submission, Error, { id: string; body: UpdateSubmissionBody }> {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, body }) => updateSubmission(id, body),
		retry: false,
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["submissions", slug] });
		},
	});
}

/** Delete a history entry. */
export function useDeleteSubmissionMutation(
	slug: string
): UseMutationResult<{ id: string }, Error, string> {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => deleteSubmission(id),
		retry: false,
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["submissions", slug] });
		},
	});
}

/** Reformat the current buffer with the server-side language formatter. */
export function useFormatMutation(): UseMutationResult<
	string,
	Error,
	FormatBody
> {
	return useMutation({
		mutationFn: (body: FormatBody) => formatCode(body),
		retry: false,
	});
}

// --- AI assistant ----------------------------------------------------------

/** Feature 4: validate complexity guesses. Never retried (one AI call). */
export function useValidateComplexityMutation(): UseMutationResult<
	ComplexityValidationResult,
	Error,
	ValidateComplexityBody
> {
	return useMutation({
		mutationFn: (body: ValidateComplexityBody) => validateComplexity(body),
		retry: false,
	});
}

export interface TutorChat {
	messages: Array<ChatMessage>;
	streaming: boolean;
	/** Streaming/transport error from the most recent turn, if any. */
	error: string | null;
	/** Send a user turn; tokens stream into the trailing assistant message. */
	send: (text: string, context: { lang: string; code: string }) => void;
	/** Abort the in-flight stream. */
	stop: () => void;
}

/**
 * Feature 6: client-held tutor conversation state with streamed replies. The
 * server is stateless, so we keep the full transcript here and replay it on
 * each turn. Keyed per `slug`; remount (via WorkspacePage's `key`) resets it.
 */
export function useTutorChat(slug: string): TutorChat {
	const [messages, setMessages] = useState<Array<ChatMessage>>([]);
	const [streaming, setStreaming] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const abortRef = useRef<AbortController | null>(null);

	const stop = useCallback((): void => {
		abortRef.current?.abort();
		abortRef.current = null;
		setStreaming(false);
	}, []);

	const send = useCallback(
		(text: string, context: { lang: string; code: string }): void => {
			const trimmed = text.trim();
			if (trimmed.length === 0 || streaming) return;

			setError(null);
			const history: Array<ChatMessage> = [
				...messages,
				{ role: "user", content: trimmed },
			];
			// Append the user turn plus an empty assistant turn to stream into.
			setMessages([...history, { role: "assistant", content: "" }]);
			setStreaming(true);

			const controller = new AbortController();
			abortRef.current = controller;

			const appendToken = (token: string): void => {
				setMessages((previous) => {
					const next = [...previous];
					const last = next[next.length - 1];
					if (last && last.role === "assistant") {
						next[next.length - 1] = {
							role: "assistant",
							content: last.content + token,
						};
					}
					return next;
				});
			};

			void streamTutorChat(
				{ slug, lang: context.lang, code: context.code, messages: history },
				{ onToken: appendToken, signal: controller.signal }
			)
				.catch((cause: unknown) => {
					if (controller.signal.aborted) return;
					setError(cause instanceof Error ? cause.message : "Tutor request failed");
				})
				.finally(() => {
					if (abortRef.current === controller) abortRef.current = null;
					setStreaming(false);
				});
		},
		[messages, slug, streaming]
	);

	return { messages, streaming, error, send, stop };
}

/**
 * Contracts for the AI assistant features, shared between client and server.
 * Type-only (see shared/README.md).
 *
 * Two features, two shapes:
 *  - Complexity validation (Feature 4): a one-shot request/response.
 *  - Tutor chat (Feature 6): a streamed conversation; the server is stateless,
 *    so the client sends the full message history on every turn.
 */

/** POST /api/ai/validate-complexity body. */
export interface ValidateComplexityBody {
	slug: string;
	lang: string;
	/** The accepted solution source to analyze. */
	code: string;
	/** The user's guessed Big-O, e.g. "O(n log n)". */
	estimatedTime: string;
	estimatedSpace: string;
	/** Solve duration; passed for context (and local SM-2 grading). */
	elapsedSeconds: number;
}

/** AI verdict on the user's complexity estimates. */
export interface ComplexityValidationResult {
	/** Actual Big-O the AI determined for the code. */
	actualTime: string;
	actualSpace: string;
	/** Whether the user's guess matched the actual bound. */
	timeCorrect: boolean;
	spaceCorrect: boolean;
	/** Plain-language explanation of the real bounds. */
	explanation: string;
}

/** Who authored a chat turn. */
export type ChatRole = "user" | "assistant";

/** One turn in the tutor conversation. */
export interface ChatMessage {
	role: ChatRole;
	content: string;
}

/** POST /api/ai/chat body. The server replays `messages` statelessly. */
export interface TutorChatBody {
	slug: string;
	lang: string;
	/** The user's current editor buffer, given to the tutor as context. */
	code: string;
	messages: Array<ChatMessage>;
}

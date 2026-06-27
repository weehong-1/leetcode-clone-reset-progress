import OpenAI from "openai";
import { z } from "zod";
import type {
	ChatMessage,
	ComplexityValidationResult,
	TutorChatBody,
	ValidateComplexityBody,
} from "@shared";
import { getCachedProblem } from "./questionCache.service";
import { getEffectiveSettings } from "./settings.service";

/** Error carrying an HTTP status for the controller to map onto the response. */
export class AIServiceError extends Error {
	public readonly statusCode: number;

	public constructor(message: string, statusCode = 502) {
		super(message);
		this.name = "AIServiceError";
		this.statusCode = statusCode;
	}
}

// Placeholder shipped in `.env.example`; treated as "no key configured".
const PLACEHOLDERS = new Set(["", "your_openrouter_or_deepseek_key_here"]);

/**
 * Resolve the OpenAI client + model from the effective settings (DB over env).
 * The client is cached and only rebuilt when the key/base URL change, so a key
 * saved in the Settings UI is picked up on the next call without a restart.
 * Throws a 503 (not a 500) when no key is configured, mirroring how the
 * LeetCode service guards on missing auth.
 */
let cached: { key: string; baseUrl: string; client: OpenAI } | null = null;
async function getRuntime(): Promise<{ client: OpenAI; model: string }> {
	const settings = await getEffectiveSettings();
	if (PLACEHOLDERS.has(settings.openaiApiKey)) {
		throw new AIServiceError(
			"AI is not configured — add your OpenAI API key in Settings.",
			503
		);
	}
	if (
		!cached ||
		cached.key !== settings.openaiApiKey ||
		cached.baseUrl !== settings.openaiBaseUrl
	) {
		cached = {
			key: settings.openaiApiKey,
			baseUrl: settings.openaiBaseUrl,
			client: new OpenAI({
				apiKey: settings.openaiApiKey,
				baseURL: settings.openaiBaseUrl,
			}),
		};
	}
	return { client: cached.client, model: settings.openaiModel };
}

/** Collapse a problem's HTML statement into plain text for prompting. */
function htmlToText(html: string): string {
	return html
		.replace(/<[^>]+>/g, " ")
		.replace(/&nbsp;/g, " ")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&amp;/g, "&")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/\s+/g, " ")
		.trim();
}

// ---------------------------------------------------------------------------
// Feature 4: post-submission complexity validation (one-shot, JSON response)
// ---------------------------------------------------------------------------

const complexitySchema = z.object({
	actualTime: z.string(),
	actualSpace: z.string(),
	timeCorrect: z.boolean(),
	spaceCorrect: z.boolean(),
	explanation: z.string(),
});

export async function validateComplexity(
	body: ValidateComplexityBody
): Promise<ComplexityValidationResult> {
	const { client, model } = await getRuntime();
	const completion = await client.chat.completions
		.create({
			model,
			temperature: 0,
			response_format: { type: "json_object" },
			messages: [
				{
					role: "system",
					content:
						"You are a precise algorithms grader. Analyze the submitted " +
						"solution and determine its true worst-case time and space " +
						"complexity in Big-O notation. Compare each against the user's " +
						"estimate (treat equivalent forms like 'O(n)' and 'O(N)' as " +
						"matching; ignore whitespace and case). Respond ONLY with a JSON " +
						"object of the exact shape: {\"actualTime\": string, " +
						'"actualSpace": string, "timeCorrect": boolean, ' +
						'"spaceCorrect": boolean, "explanation": string}. The ' +
						"explanation should be 2-4 sentences justifying the real bounds.",
				},
				{
					role: "user",
					content:
						`Language: ${body.lang}\n` +
						`User's time estimate: ${body.estimatedTime}\n` +
						`User's space estimate: ${body.estimatedSpace}\n\n` +
						`Solution:\n${body.code}`,
				},
			],
		})
		.catch((cause: unknown) => {
			throw new AIServiceError(`AI request failed: ${String(cause)}`, 502);
		});

	const raw = completion.choices[0]?.message.content;
	if (!raw) {
		throw new AIServiceError("AI returned an empty response", 502);
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		throw new AIServiceError("AI returned malformed JSON", 502);
	}

	const result = complexitySchema.safeParse(parsed);
	if (!result.success) {
		throw new AIServiceError("AI response did not match the expected shape", 502);
	}
	return result.data;
}

// ---------------------------------------------------------------------------
// Feature 6: AI interviewer / tutor (multi-turn, streamed)
// ---------------------------------------------------------------------------

/** The strict tutor bounds from ARCHITECTURE.md §6, verbatim. */
const TUTOR_RULES =
	"I want to discuss a LeetCode problem. Act as my technical interviewer and " +
	"LeetCode tutor.\nStrict rules:\n" +
	"1. Do NOT give me the final code, answer, or direct hints unless explicitly asked.\n" +
	"2. Explain problems using simple real-world analogies, but leave the solution design to me.\n" +
	"3. Validate suggested patterns (DP, Greedy, BFS) or gently point out flaws (e.g., complexity issues).\n" +
	"4. When requested, provide clean, commented Java code, complexity data, and structural mental boilerplate.\n" +
	"5. Verify against optimal community implementations.";

async function buildTutorSystemPrompt(body: TutorChatBody): Promise<string> {
	// Pull the problem statement for grounding. Best-effort: if it can't be
	// fetched, the tutor still works from the rules + the user's code.
	let problemContext = "";
	try {
		const problem = await getCachedProblem(body.slug);
		problemContext =
			`\n\n--- Active problem ---\n` +
			`${problem.questionFrontendId}. ${problem.title} (${problem.difficulty})\n` +
			`${htmlToText(problem.content)}`;
	} catch {
		problemContext = `\n\n--- Active problem ---\nSlug: ${body.slug}`;
	}

	const code = body.code.trim();
	const codeContext =
		code.length > 0
			? `\n\n--- My current ${body.lang} code ---\n${code}`
			: `\n\n(The candidate has not written any code yet.)`;

	return `${TUTOR_RULES}${problemContext}${codeContext}`;
}

/**
 * Stream the tutor's reply token-by-token. Yields content deltas as they
 * arrive; the controller relays them as SSE events.
 */
export async function* streamTutorChat(
	body: TutorChatBody
): AsyncIterable<string> {
	const systemPrompt = await buildTutorSystemPrompt(body);

	const { client, model } = await getRuntime();
	const stream = await client.chat.completions
		.create({
			model,
			temperature: 0.4,
			stream: true,
			messages: [
				{ role: "system", content: systemPrompt },
				...body.messages.map((m: ChatMessage) => ({
					role: m.role,
					content: m.content,
				})),
			],
		})
		.catch((cause: unknown) => {
			throw new AIServiceError(`AI request failed: ${String(cause)}`, 502);
		});

	for await (const chunk of stream) {
		const token = chunk.choices[0]?.delta.content;
		if (token) {
			yield token;
		}
	}
}

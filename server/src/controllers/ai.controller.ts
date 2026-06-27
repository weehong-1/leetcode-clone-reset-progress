import type { Request, Response } from "express";
import { z } from "zod";
import type { ApiResponse, ComplexityValidationResult } from "@shared";
import {
	AIServiceError,
	streamTutorChat,
	validateComplexity,
} from "../services/ai.service";

const slugSchema = z
	.string()
	.min(1)
	.regex(/^[a-zA-Z0-9-]+$/, "Invalid problem slug");

const validateComplexitySchema = z.object({
	slug: slugSchema,
	lang: z.string().min(1),
	code: z.string().min(1),
	estimatedTime: z.string().trim().max(60),
	estimatedSpace: z.string().trim().max(60),
	elapsedSeconds: z.number().int().min(0),
});

const chatMessageSchema = z.object({
	role: z.enum(["user", "assistant"]),
	content: z.string().min(1).max(20_000),
});

const tutorChatSchema = z.object({
	slug: slugSchema,
	lang: z.string().min(1),
	code: z.string().max(50_000),
	messages: z.array(chatMessageSchema).min(1).max(50),
});

function fail(response: Response, status: number, message: string): void {
	const body: ApiResponse<never> = { success: false, error: message };
	response.status(status).json(body);
}

/** Map an AIServiceError onto its status; everything else is a 500. */
function handleError(response: Response, error: unknown): void {
	if (error instanceof AIServiceError) {
		fail(response, error.statusCode, error.message);
		return;
	}
	console.error("Unexpected AI controller error:", error);
	fail(response, 500, "Internal server error");
}

/** POST /api/ai/validate-complexity */
export async function validateComplexityHandler(
	request: Request,
	response: Response
): Promise<void> {
	const parsed = validateComplexitySchema.safeParse(request.body);
	if (!parsed.success) {
		fail(response, 400, parsed.error.issues[0]?.message ?? "Invalid request body");
		return;
	}
	try {
		const data = await validateComplexity(parsed.data);
		const body: ApiResponse<ComplexityValidationResult> = {
			success: true,
			data,
		};
		response.json(body);
	} catch (error) {
		handleError(response, error);
	}
}

/**
 * POST /api/ai/chat — streams the tutor reply as Server-Sent Events.
 *
 * Each event carries one JSON payload: `{ token }` for content deltas, a final
 * `{ done: true }`, or `{ error }` if the stream fails partway. Validation
 * failures still return the normal JSON envelope (headers aren't committed yet).
 */
export async function tutorChatHandler(
	request: Request,
	response: Response
): Promise<void> {
	const parsed = tutorChatSchema.safeParse(request.body);
	if (!parsed.success) {
		fail(response, 400, parsed.error.issues[0]?.message ?? "Invalid request body");
		return;
	}

	response.setHeader("Content-Type", "text/event-stream");
	response.setHeader("Cache-Control", "no-cache");
	response.setHeader("Connection", "keep-alive");
	response.flushHeaders();

	// Stop pulling from the model if the client navigates away / aborts. Listen
	// on the response, not the request: `express.json()` fully consumes the
	// request stream, so `request`'s "close" fires as soon as the body is read.
	// The response only closes on a real client disconnect (or our own end()).
	let aborted = false;
	response.on("close", () => {
		if (!response.writableEnded) aborted = true;
	});

	const send = (payload: unknown): void => {
		response.write(`data: ${JSON.stringify(payload)}\n\n`);
	};

	try {
		for await (const token of streamTutorChat(parsed.data)) {
			if (aborted) break;
			send({ token });
		}
		if (!aborted) {
			send({ done: true });
		}
	} catch (error) {
		const message =
			error instanceof AIServiceError
				? error.message
				: "AI streaming failed";
		if (!(error instanceof AIServiceError)) {
			console.error("Unexpected AI streaming error:", error);
		}
		if (!aborted) {
			send({ error: message });
		}
	} finally {
		response.end();
	}
}

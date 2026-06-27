import type { Request, Response } from "express";
import { z } from "zod";
import type {
	ApiResponse,
	JudgeResult,
	LeetCodeProblem,
	ProblemListResult,
} from "@shared";
import {
	getProblemList,
	LeetCodeError,
	runCode,
	submitCode,
} from "../services/leetcode.service";
import { getCachedProblem } from "../services/questionCache.service";

const slugSchema = z
	.string()
	.min(1)
	.regex(/^[a-zA-Z0-9-]+$/, "Invalid problem slug");

const listQuerySchema = z.object({
	limit: z.coerce.number().int().min(1).max(100).default(50),
	skip: z.coerce.number().int().min(0).default(0),
	difficulty: z.enum(["Easy", "Medium", "Hard"]).optional(),
	search: z.string().trim().min(1).optional(),
	// Comma-separated topic-tag slugs, e.g. "array,hash-table".
	tags: z
		.string()
		.optional()
		.transform((value) =>
			value
				? value
						.split(",")
						.map((tag) => tag.trim())
						.filter((tag) => tag.length > 0)
				: undefined
		),
});

const runSchema = z.object({
	lang: z.string().min(1),
	code: z.string().min(1),
	dataInput: z.string().optional(),
});

const submitSchema = z.object({
	lang: z.string().min(1),
	code: z.string().min(1),
});

/** Maps service/validation errors onto a consistent JSON error envelope. */
function fail(response: Response, status: number, message: string): void {
	const body: ApiResponse<never> = { success: false, error: message };
	response.status(status).json(body);
}

function handleError(response: Response, error: unknown): void {
	if (error instanceof LeetCodeError) {
		fail(response, error.statusCode, error.message);
		return;
	}
	console.error("Unexpected LeetCode controller error:", error);
	fail(response, 500, "Internal server error");
}

/** GET /api/leetcode/problems */
export async function getProblemListHandler(
	request: Request,
	response: Response
): Promise<void> {
	const parsed = listQuerySchema.safeParse(request.query);
	if (!parsed.success) {
		fail(response, 400, parsed.error.issues[0]?.message ?? "Invalid query");
		return;
	}
	try {
		const result = await getProblemList(parsed.data);
		const body: ApiResponse<ProblemListResult> = {
			success: true,
			data: result,
		};
		response.json(body);
	} catch (error) {
		handleError(response, error);
	}
}

/** GET /api/leetcode/problems/:slug */
export async function getProblemHandler(
	request: Request,
	response: Response
): Promise<void> {
	const parsed = slugSchema.safeParse(request.params["slug"]);
	if (!parsed.success) {
		fail(response, 400, "Invalid problem slug");
		return;
	}
	// `?refresh=true` forces a live re-fetch that overwrites the cached copy.
	const refresh = request.query["refresh"] === "true";
	try {
		const problem = await getCachedProblem(parsed.data, { refresh });
		const body: ApiResponse<LeetCodeProblem> = { success: true, data: problem };
		response.json(body);
	} catch (error) {
		handleError(response, error);
	}
}

/** POST /api/leetcode/problems/:slug/run */
export async function runHandler(
	request: Request,
	response: Response
): Promise<void> {
	const slug = slugSchema.safeParse(request.params["slug"]);
	if (!slug.success) {
		fail(response, 400, "Invalid problem slug");
		return;
	}
	const parsed = runSchema.safeParse(request.body);
	if (!parsed.success) {
		fail(response, 400, parsed.error.issues[0]?.message ?? "Invalid request body");
		return;
	}
	try {
		const result = await runCode({ slug: slug.data, ...parsed.data });
		const body: ApiResponse<JudgeResult> = { success: true, data: result };
		response.json(body);
	} catch (error) {
		handleError(response, error);
	}
}

/** POST /api/leetcode/problems/:slug/submit */
export async function submitHandler(
	request: Request,
	response: Response
): Promise<void> {
	const slug = slugSchema.safeParse(request.params["slug"]);
	if (!slug.success) {
		fail(response, 400, "Invalid problem slug");
		return;
	}
	const parsed = submitSchema.safeParse(request.body);
	if (!parsed.success) {
		fail(response, 400, parsed.error.issues[0]?.message ?? "Invalid request body");
		return;
	}
	try {
		const result = await submitCode({ slug: slug.data, ...parsed.data });
		const body: ApiResponse<JudgeResult> = { success: true, data: result };
		response.json(body);
	} catch (error) {
		handleError(response, error);
	}
}

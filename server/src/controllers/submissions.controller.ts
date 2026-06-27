import type { Request, Response } from "express";
import { z } from "zod";
import type { ApiResponse, Submission } from "@shared";
import {
	createSnapshot,
	deleteSubmission,
	listSubmissions,
	updateSubmission,
} from "../services/submissions.service";

const slugSchema = z
	.string()
	.min(1)
	.regex(/^[a-zA-Z0-9-]+$/, "Invalid problem slug");

const idSchema = z.string().regex(/^[a-f0-9]{24}$/, "Invalid submission id");

const snapshotSchema = z.object({
	slug: slugSchema,
	lang: z.string().min(1),
	code: z.string().min(1),
	name: z.string().trim().max(120).optional(),
	note: z.string().max(5000).optional(),
});

const updateSchema = z
	.object({
		name: z.string().trim().max(120).optional(),
		note: z.string().max(5000).optional(),
	})
	.refine((body) => body.name !== undefined || body.note !== undefined, {
		message: "Provide at least one of name or note",
	});

function fail(response: Response, status: number, message: string): void {
	const body: ApiResponse<never> = { success: false, error: message };
	response.status(status).json(body);
}

/** Mongo unreachable (server down, buffering timeout) → 503 rather than 500. */
function handleError(response: Response, error: unknown): void {
	const name = error instanceof Error ? error.name : "";
	const message = error instanceof Error ? error.message : "";
	if (name.includes("Mongo") || message.includes("buffering timed out")) {
		fail(
			response,
			503,
			"Submission history needs MongoDB. Start your database and try again."
		);
		return;
	}
	console.error("Unexpected submissions controller error:", error);
	fail(response, 500, "Internal server error");
}

/** GET /api/submissions?slug=<slug> */
export async function listSubmissionsHandler(
	request: Request,
	response: Response
): Promise<void> {
	const parsed = slugSchema.safeParse(request.query["slug"]);
	if (!parsed.success) {
		fail(response, 400, "Invalid or missing slug");
		return;
	}
	try {
		const data = await listSubmissions(parsed.data);
		const body: ApiResponse<Array<Submission>> = { success: true, data };
		response.json(body);
	} catch (error) {
		handleError(response, error);
	}
}

/** POST /api/submissions */
export async function createSnapshotHandler(
	request: Request,
	response: Response
): Promise<void> {
	const parsed = snapshotSchema.safeParse(request.body);
	if (!parsed.success) {
		fail(response, 400, parsed.error.issues[0]?.message ?? "Invalid request body");
		return;
	}
	try {
		const data = await createSnapshot(parsed.data);
		const body: ApiResponse<Submission> = { success: true, data };
		response.status(201).json(body);
	} catch (error) {
		handleError(response, error);
	}
}

/** PATCH /api/submissions/:id */
export async function updateSubmissionHandler(
	request: Request,
	response: Response
): Promise<void> {
	const id = idSchema.safeParse(request.params["id"]);
	if (!id.success) {
		fail(response, 400, "Invalid submission id");
		return;
	}
	const parsed = updateSchema.safeParse(request.body);
	if (!parsed.success) {
		fail(response, 400, parsed.error.issues[0]?.message ?? "Invalid request body");
		return;
	}
	try {
		const data = await updateSubmission(id.data, parsed.data);
		if (!data) {
			fail(response, 404, "Submission not found");
			return;
		}
		const body: ApiResponse<Submission> = { success: true, data };
		response.json(body);
	} catch (error) {
		handleError(response, error);
	}
}

/** DELETE /api/submissions/:id */
export async function deleteSubmissionHandler(
	request: Request,
	response: Response
): Promise<void> {
	const id = idSchema.safeParse(request.params["id"]);
	if (!id.success) {
		fail(response, 400, "Invalid submission id");
		return;
	}
	try {
		const removed = await deleteSubmission(id.data);
		if (!removed) {
			fail(response, 404, "Submission not found");
			return;
		}
		const body: ApiResponse<{ id: string }> = {
			success: true,
			data: { id: id.data },
		};
		response.json(body);
	} catch (error) {
		handleError(response, error);
	}
}

import type { Request, Response } from "express";
import { z } from "zod";
import type {
	ApiResponse,
	ProblemListDetail,
	ProblemListSummary,
} from "@shared";
import {
	getCuratedList,
	isCuratedId,
	listCuratedSummaries,
} from "../services/curated.service";
import {
	addProblemToList,
	createCustomList,
	deleteCustomList,
	getCustomList,
	listCustomSummaries,
	removeProblemFromList,
	renameCustomList,
} from "../services/customList.service";
import { ListError } from "../services/list.errors";

const idSchema = z
	.string()
	.min(1)
	.regex(/^[a-z0-9-]+$/, "Invalid list id");

const slugSchema = z
	.string()
	.min(1)
	.regex(/^[a-z0-9-]+$/, "Invalid problem slug");

const nameSchema = z.object({ name: z.string() });
const addProblemSchema = z.object({ slug: z.string().min(1) });

/** Maps service/validation errors onto a consistent JSON error envelope. */
function fail(response: Response, status: number, message: string): void {
	const body: ApiResponse<never> = { success: false, error: message };
	response.status(status).json(body);
}

function handleError(response: Response, error: unknown): void {
	if (error instanceof ListError) {
		fail(response, error.statusCode, error.message);
		return;
	}
	console.error("Unexpected list controller error:", error);
	fail(response, 500, "Internal server error");
}

function ok<T>(response: Response, data: T): void {
	const body: ApiResponse<T> = { success: true, data };
	response.json(body);
}

/** Parse + validate the `:id` route param, or send a 400 and return null. */
function parseId(request: Request, response: Response): string | null {
	const parsed = idSchema.safeParse(request.params["id"]);
	if (!parsed.success) {
		fail(response, 400, "Invalid list id");
		return null;
	}
	return parsed.data;
}

/** Reject mutations targeting a built-in curated list. */
function assertEditable(id: string): void {
	if (isCuratedId(id)) {
		throw new ListError("Curated lists are read-only", 403);
	}
}

/** GET /api/lists — custom lists first, then curated. */
export async function getListsHandler(
	_request: Request,
	response: Response
): Promise<void> {
	try {
		// Curated lists are static and must always render. Custom lists need the
		// database, so tolerate its failure instead of dropping the presets too.
		const [custom, curated] = await Promise.all([
			listCustomSummaries().catch((error: unknown) => {
				console.error("Failed to load custom lists (showing curated only):", error);
				return [] as Array<ProblemListSummary>;
			}),
			listCuratedSummaries(),
		]);
		const summaries: Array<ProblemListSummary> = [...custom, ...curated];
		ok(response, summaries);
	} catch (error) {
		handleError(response, error);
	}
}

/** POST /api/lists — create a custom list. */
export async function createListHandler(
	request: Request,
	response: Response
): Promise<void> {
	const parsed = nameSchema.safeParse(request.body);
	if (!parsed.success) {
		fail(response, 400, "A list name is required");
		return;
	}
	try {
		const summary = await createCustomList(parsed.data.name);
		const body: ApiResponse<ProblemListSummary> = {
			success: true,
			data: summary,
		};
		response.status(201).json(body);
	} catch (error) {
		handleError(response, error);
	}
}

/** GET /api/lists/:id — curated or custom detail. */
export async function getListHandler(
	request: Request,
	response: Response
): Promise<void> {
	const id = parseId(request, response);
	if (id === null) return;
	try {
		const detail: ProblemListDetail = isCuratedId(id)
			? await getCuratedList(id)
			: await getCustomList(id);
		ok(response, detail);
	} catch (error) {
		handleError(response, error);
	}
}

/** PATCH /api/lists/:id — rename a custom list. */
export async function renameListHandler(
	request: Request,
	response: Response
): Promise<void> {
	const id = parseId(request, response);
	if (id === null) return;
	const parsed = nameSchema.safeParse(request.body);
	if (!parsed.success) {
		fail(response, 400, "A list name is required");
		return;
	}
	try {
		assertEditable(id);
		ok(response, await renameCustomList(id, parsed.data.name));
	} catch (error) {
		handleError(response, error);
	}
}

/** DELETE /api/lists/:id — delete a custom list. */
export async function deleteListHandler(
	request: Request,
	response: Response
): Promise<void> {
	const id = parseId(request, response);
	if (id === null) return;
	try {
		assertEditable(id);
		await deleteCustomList(id);
		ok(response, { id });
	} catch (error) {
		handleError(response, error);
	}
}

/** POST /api/lists/:id/problems — add a problem to a custom list. */
export async function addProblemHandler(
	request: Request,
	response: Response
): Promise<void> {
	const id = parseId(request, response);
	if (id === null) return;
	const parsed = addProblemSchema.safeParse(request.body);
	if (!parsed.success) {
		fail(response, 400, "A problem slug or URL is required");
		return;
	}
	try {
		assertEditable(id);
		ok(response, await addProblemToList(id, parsed.data.slug));
	} catch (error) {
		handleError(response, error);
	}
}

/** DELETE /api/lists/:id/problems/:slug — remove a problem from a custom list. */
export async function removeProblemHandler(
	request: Request,
	response: Response
): Promise<void> {
	const id = parseId(request, response);
	if (id === null) return;
	const slug = slugSchema.safeParse(request.params["slug"]);
	if (!slug.success) {
		fail(response, 400, "Invalid problem slug");
		return;
	}
	try {
		assertEditable(id);
		ok(response, await removeProblemFromList(id, slug.data));
	} catch (error) {
		handleError(response, error);
	}
}

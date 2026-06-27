import type { Request, Response } from "express";
import { z } from "zod";
import type { ApiResponse, SettingsView } from "@shared";
import {
	getSettingsView,
	SettingsError,
	updateSettings,
} from "../services/settings.service";

// Generous caps — session cookies/keys can be long. Empty string is allowed
// (it clears the stored override).
const secret = z.string().max(8000);
const updateSchema = z
	.object({
		openaiApiKey: secret.optional(),
		openaiBaseUrl: z.string().max(500).optional(),
		openaiModel: z.string().max(200).optional(),
		leetcodeSession: secret.optional(),
		csrfToken: secret.optional(),
	})
	.strict();

function fail(response: Response, status: number, message: string): void {
	const body: ApiResponse<never> = { success: false, error: message };
	response.status(status).json(body);
}

function handleError(response: Response, error: unknown): void {
	if (error instanceof SettingsError) {
		fail(response, error.statusCode, error.message);
		return;
	}
	const name = error instanceof Error ? error.name : "";
	if (name.includes("Mongo")) {
		fail(response, 503, "Settings need MongoDB. Start your database and try again.");
		return;
	}
	console.error("Unexpected settings controller error:", error);
	fail(response, 500, "Internal server error");
}

/** GET /api/settings — masked, client-safe view (never raw secrets). */
export async function getSettingsHandler(
	_request: Request,
	response: Response
): Promise<void> {
	try {
		const data = await getSettingsView();
		const body: ApiResponse<SettingsView> = { success: true, data };
		response.json(body);
	} catch (error) {
		handleError(response, error);
	}
}

/** PATCH /api/settings — apply a partial update, return the fresh masked view. */
export async function updateSettingsHandler(
	request: Request,
	response: Response
): Promise<void> {
	const parsed = updateSchema.safeParse(request.body);
	if (!parsed.success) {
		fail(response, 400, parsed.error.issues[0]?.message ?? "Invalid request body");
		return;
	}
	try {
		const data = await updateSettings(parsed.data);
		const body: ApiResponse<SettingsView> = { success: true, data };
		response.json(body);
	} catch (error) {
		handleError(response, error);
	}
}

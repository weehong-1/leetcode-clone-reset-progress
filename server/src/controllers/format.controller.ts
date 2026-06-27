import type { Request, Response } from "express";
import { z } from "zod";
import type { ApiResponse, FormatResult } from "@shared";
import { FormatError, formatCode } from "../services/format.service";

const formatSchema = z.object({
	lang: z.string().min(1),
	code: z.string().min(1),
});

function fail(response: Response, status: number, message: string): void {
	const body: ApiResponse<never> = { success: false, error: message };
	response.status(status).json(body);
}

/** POST /api/format */
export async function formatHandler(
	request: Request,
	response: Response
): Promise<void> {
	const parsed = formatSchema.safeParse(request.body);
	if (!parsed.success) {
		fail(response, 400, parsed.error.issues[0]?.message ?? "Invalid request body");
		return;
	}

	try {
		const formatted = await formatCode(parsed.data);
		const body: ApiResponse<FormatResult> = {
			success: true,
			data: { formatted },
		};
		response.json(body);
	} catch (error) {
		if (error instanceof FormatError) {
			fail(response, error.statusCode, error.message);
			return;
		}
		console.error("Unexpected format error:", error);
		fail(response, 500, "Internal server error");
	}
}

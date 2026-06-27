import type { Request, Response } from "express";
import type { ApiResponse, ResetProgressResult } from "@shared";
import { ListError } from "../services/list.errors";
import { resetMainProgress } from "../services/progress.service";

/** POST /api/progress/reset — un-solve all problems not in any saved list. */
export async function resetProgressHandler(
	_request: Request,
	response: Response
): Promise<void> {
	try {
		const result = await resetMainProgress();
		const body: ApiResponse<ResetProgressResult> = {
			success: true,
			data: result,
		};
		response.json(body);
	} catch (error) {
		if (error instanceof ListError) {
			const body: ApiResponse<never> = { success: false, error: error.message };
			response.status(error.statusCode).json(body);
			return;
		}
		console.error("Unexpected progress controller error:", error);
		const body: ApiResponse<never> = {
			success: false,
			error: "Internal server error",
		};
		response.status(500).json(body);
	}
}

import { Router, type Request, type Response } from "express";
import mongoose from "mongoose";
import type { DatabaseState, HealthResponse } from "@shared";

export const healthRouter = Router();

const DB_STATES: readonly DatabaseState[] = [
	"disconnected",
	"connected",
	"connecting",
	"disconnecting",
];

/**
 * Liveness/readiness probe. Reports process health plus the current Mongoose
 * connection state so the frontend (and `npm run dev`) can confirm the backend
 * is wired up correctly.
 */
healthRouter.get("/", (_request: Request, response: Response<HealthResponse>) => {
	const dbState = DB_STATES[mongoose.connection.readyState] ?? "unknown";

	response.json({
		status: "ok",
		service: "leettrace",
		database: dbState,
		timestamp: new Date().toISOString(),
	});
});

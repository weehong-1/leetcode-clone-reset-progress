import cors from "cors";
import express, { type Express } from "express";
import { aiRouter } from "./routes/ai.routes";
import { formatRouter } from "./routes/format.routes";
import { healthRouter } from "./routes/health.routes";
import { leetcodeRouter } from "./routes/leetcode.routes";
import { listsRouter } from "./routes/lists.routes";
import { progressRouter } from "./routes/progress.routes";
import { settingsRouter } from "./routes/settings.routes";
import { submissionsRouter } from "./routes/submissions.routes";

/**
 * Builds and configures the Express application. Kept separate from the
 * `listen` call in `server.ts` so it can be imported directly by tests later.
 */
export function createApp(): Express {
	const app = express();

	app.use(cors());
	app.use(express.json({ limit: "1mb" }));

	// Feature routers. More mount here as the backend grows (progress/SM-2).
	app.use("/api/health", healthRouter);
	app.use("/api/leetcode", leetcodeRouter);
	app.use("/api/lists", listsRouter);
	app.use("/api/format", formatRouter);
	app.use("/api/submissions", submissionsRouter);
	app.use("/api/progress", progressRouter);
	app.use("/api/ai", aiRouter);
	app.use("/api/settings", settingsRouter);

	return app;
}

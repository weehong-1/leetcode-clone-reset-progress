import { connectToDatabase, disconnectFromDatabase } from "./src/config/db";
import { env } from "./src/config/env";
import { createApp } from "./src/app";

function bootstrap(): void {
	const app = createApp();

	const server = app.listen(env.PORT, () => {
		console.log(`🚀 Server listening on http://localhost:${env.PORT}`);
	});

	// Best-effort DB connection started after the HTTP server is already
	// listening: during scaffolding MongoDB may not be running yet, so we warn
	// instead of crashing and still serve the health endpoint immediately.
	connectToDatabase().catch((error) => {
		console.warn(
			"⚠️  Could not connect to MongoDB on startup. The server will run, " +
				"but database-backed routes will fail until Mongo is available."
		);
		console.warn(error);
	});

	const shutdown = async (signal: string): Promise<void> => {
		console.log(`\n${signal} received, shutting down gracefully...`);
		server.close();
		await disconnectFromDatabase();
		process.exit(0);
	};

	process.on("SIGINT", () => void shutdown("SIGINT"));
	process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

try {
	bootstrap();
} catch (error) {
	console.error("Failed to start server:", error);
	process.exit(1);
}

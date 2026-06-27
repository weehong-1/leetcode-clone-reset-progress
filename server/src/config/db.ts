import mongoose from "mongoose";
import { env } from "./env";

let connection: typeof mongoose | null = null;

/**
 * Establishes (and memoizes) the Mongoose connection. Safe to call multiple
 * times — subsequent calls return the existing connection.
 */
export async function connectToDatabase(): Promise<typeof mongoose> {
	if (connection) {
		return connection;
	}

	mongoose.connection.on("connected", () => {
		console.log("🗄️  MongoDB connected");
	});
	mongoose.connection.on("error", (error) => {
		console.error("🗄️  MongoDB connection error:", error);
	});
	mongoose.connection.on("disconnected", () => {
		console.warn("🗄️  MongoDB disconnected");
	});

	connection = await mongoose.connect(env.MONGODB_URI);
	return connection;
}

/**
 * Closes the Mongoose connection, used on graceful shutdown.
 */
export async function disconnectFromDatabase(): Promise<void> {
	if (!connection) {
		return;
	}
	await mongoose.disconnect();
	connection = null;
}

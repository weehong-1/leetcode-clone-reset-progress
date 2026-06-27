import dotenv from "dotenv";

// The dev/server scripts are launched from the repository root
// (`tsx server/server.ts`), so the default `.env` lookup resolves to the
// project root where `.env.example` already lives. Copy `.env.example` to
// `.env` and fill in the values to configure the backend.
//
// `.env.local` is loaded first and wins on conflicts (dotenv never overrides
// an already-set var), mirroring Vite's precedence so a single gitignored
// `.env.local` can drive both the frontend and backend.
dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ quiet: true });

/**
 * Reads an environment variable, falling back to `fallback` when it is unset.
 * Throws when a variable is required (no fallback) but missing, so the server
 * fails fast with a clear message instead of a confusing runtime error later.
 */
function readEnv(key: string, fallback?: string): string {
	const value = process.env[key];
	if (value !== undefined && value !== "") {
		return value;
	}
	if (fallback !== undefined) {
		return fallback;
	}
	throw new Error(`Missing required environment variable: ${key}`);
}

/**
 * Typed, centralized view of the backend configuration.
 *
 * Secrets used by later phases (LeetCode auth + AI provider) are exposed as
 * optional strings here so the scaffold compiles and boots without them; the
 * services that need them will validate their presence at call time.
 */
export const env = {
	PORT: Number.parseInt(readEnv("PORT", "3001"), 10),
	MONGODB_URI: readEnv("MONGODB_URI", "mongodb://localhost:27017/leettrace"),

	LEETCODE_SESSION: process.env["LEETCODE_SESSION"] ?? "",
	CSRF_TOKEN: process.env["CSRF_TOKEN"] ?? "",

	OPENAI_API_KEY: process.env["OPENAI_API_KEY"] ?? "",
	OPENAI_BASE_URL:
		process.env["OPENAI_BASE_URL"] ?? "https://openrouter.ai/api/v1",
	OPENAI_MODEL: process.env["OPENAI_MODEL"] ?? "deepseek/deepseek-chat",

	// Path to the google-java-format jar (for Java code formatting). Optional.
	GOOGLE_JAVA_FORMAT_JAR: process.env["GOOGLE_JAVA_FORMAT_JAR"] ?? "",
} as const;

export type Env = typeof env;

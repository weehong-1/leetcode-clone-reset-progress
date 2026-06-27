import mongoose from "mongoose";
import type {
	SecretView,
	SettingsView,
	SettingSource,
	UpdateSettingsBody,
} from "@shared";
import { env } from "../config/env";
import { type ISettings, SettingsModel } from "../models/settings.model";

/** Error carrying an HTTP status for the controller to map onto the response. */
export class SettingsError extends Error {
	public readonly statusCode: number;

	public constructor(message: string, statusCode = 500) {
		super(message);
		this.name = "SettingsError";
		this.statusCode = statusCode;
	}
}

/** Effective (raw) runtime configuration — DB overrides env. */
export interface EffectiveSettings {
	openaiApiKey: string;
	openaiBaseUrl: string;
	openaiModel: string;
	leetcodeSession: string;
	csrfToken: string;
}

// Placeholders shipped in `.env.example`; treated as "not configured".
const OPENAI_PLACEHOLDERS = new Set(["", "your_openrouter_or_deepseek_key_here"]);
const LEETCODE_PLACEHOLDERS = new Set([
	"",
	"your_session_cookie_here",
	"your_csrf_token_here",
]);

function isMongoConnected(): boolean {
	return mongoose.connection.readyState === 1;
}

// In-memory cache of the merged settings, invalidated whenever we write. Avoids
// a DB round-trip on every AI / LeetCode call within a session.
let cache: EffectiveSettings | null = null;

/** A DB override only counts when it is a non-empty string. */
function pick(dbValue: string | undefined, envValue: string): string {
	return dbValue !== undefined && dbValue !== "" ? dbValue : envValue;
}

/**
 * Resolve the effective config (DB over env). Falls back to env entirely when
 * Mongo is unreachable, so the app degrades gracefully. Memoized.
 */
export async function getEffectiveSettings(): Promise<EffectiveSettings> {
	if (cache) return cache;

	const fromEnv: EffectiveSettings = {
		openaiApiKey: env.OPENAI_API_KEY,
		openaiBaseUrl: env.OPENAI_BASE_URL,
		openaiModel: env.OPENAI_MODEL,
		leetcodeSession: env.LEETCODE_SESSION,
		csrfToken: env.CSRF_TOKEN,
	};

	if (!isMongoConnected()) {
		// Don't memoize a degraded read — pick up the DB once it connects.
		return fromEnv;
	}

	let doc: ISettings | null = null;
	try {
		doc = await SettingsModel.findOne({ key: "global" }).lean<ISettings>().exec();
	} catch {
		return fromEnv;
	}

	cache = {
		openaiApiKey: pick(doc?.openaiApiKey, fromEnv.openaiApiKey),
		openaiBaseUrl: pick(doc?.openaiBaseUrl, fromEnv.openaiBaseUrl),
		openaiModel: pick(doc?.openaiModel, fromEnv.openaiModel),
		leetcodeSession: pick(doc?.leetcodeSession, fromEnv.leetcodeSession),
		csrfToken: pick(doc?.csrfToken, fromEnv.csrfToken),
	};
	return cache;
}

/** Drop the cache so the next read re-resolves from the DB. */
export function invalidateSettingsCache(): void {
	cache = null;
}

function requireDatabase(): void {
	if (!isMongoConnected()) {
		throw new SettingsError(
			"Saving settings needs MongoDB. Start your database and try again.",
			503
		);
	}
}

/** Mask a secret for display: first 3 + dots + last 2 (never the full value). */
function maskSecret(value: string): string {
	if (value.length <= 5) return "•••••";
	return `${value.slice(0, 3)}••••${value.slice(-2)}`;
}

function secretView(
	dbValue: string | undefined,
	envValue: string,
	placeholders: Set<string>
): SecretView {
	const dbReal = dbValue !== undefined && !placeholders.has(dbValue);
	const envReal = !placeholders.has(envValue);
	const effective = dbReal ? (dbValue ?? "") : envValue;
	const source: SettingSource = dbReal ? "database" : envReal ? "env" : "none";
	return {
		set: dbReal || envReal,
		masked: dbReal || envReal ? maskSecret(effective) : "",
		source,
	};
}

/** Build the masked, client-safe settings view. */
export async function getSettingsView(): Promise<SettingsView> {
	let doc: ISettings | null = null;
	if (isMongoConnected()) {
		try {
			doc = await SettingsModel.findOne({ key: "global" })
				.lean<ISettings>()
				.exec();
		} catch {
			doc = null;
		}
	}

	const effective = await getEffectiveSettings();

	return {
		openai: {
			apiKey: secretView(doc?.openaiApiKey, env.OPENAI_API_KEY, OPENAI_PLACEHOLDERS),
			baseUrl: effective.openaiBaseUrl,
			model: effective.openaiModel,
		},
		leetcode: {
			session: secretView(
				doc?.leetcodeSession,
				env.LEETCODE_SESSION,
				LEETCODE_PLACEHOLDERS
			),
			csrf: secretView(doc?.csrfToken, env.CSRF_TOKEN, LEETCODE_PLACEHOLDERS),
		},
	};
}

/**
 * Apply a partial update to the stored settings. Per field: a non-empty string
 * sets the override, an empty string clears it (revert to env), and an omitted
 * field is left unchanged. Returns the fresh masked view.
 */
export async function updateSettings(
	patch: UpdateSettingsBody
): Promise<SettingsView> {
	requireDatabase();

	const set: Partial<ISettings> = {};
	if (patch.openaiApiKey !== undefined) set.openaiApiKey = patch.openaiApiKey;
	if (patch.openaiBaseUrl !== undefined) set.openaiBaseUrl = patch.openaiBaseUrl;
	if (patch.openaiModel !== undefined) set.openaiModel = patch.openaiModel;
	if (patch.leetcodeSession !== undefined)
		set.leetcodeSession = patch.leetcodeSession;
	if (patch.csrfToken !== undefined) set.csrfToken = patch.csrfToken;

	await SettingsModel.updateOne(
		{ key: "global" },
		{ $set: set },
		{ upsert: true }
	).exec();

	invalidateSettingsCache();
	return getSettingsView();
}

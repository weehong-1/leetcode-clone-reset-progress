/**
 * Contracts for the runtime settings feature, shared between client and server.
 * Type-only (see shared/README.md).
 *
 * Secrets (API keys, session cookies) are NEVER sent to the client in full —
 * the read view exposes only a masked preview plus whether a value is set and
 * where it comes from. Writes are one-directional (client → server).
 */

/** Where an effective value originates. */
export type SettingSource = "env" | "database" | "none";

/** Client-safe view of one secret. */
export interface SecretView {
	/** True when a usable (non-placeholder) value is configured. */
	set: boolean;
	/** Masked preview, e.g. "sk-••••az". Empty string when unset. */
	masked: string;
	source: SettingSource;
}

/** GET /api/settings response — never contains raw secret values. */
export interface SettingsView {
	openai: {
		apiKey: SecretView;
		/** Non-secret; safe to show in full. */
		baseUrl: string;
		model: string;
	};
	leetcode: {
		session: SecretView;
		csrf: SecretView;
	};
}

/**
 * PATCH /api/settings body. Every field is optional:
 *  - non-empty string → set/replace the stored value
 *  - empty string ""  → clear the stored override (revert to env / none)
 *  - omitted          → leave unchanged
 */
export interface UpdateSettingsBody {
	openaiApiKey?: string;
	openaiBaseUrl?: string;
	openaiModel?: string;
	leetcodeSession?: string;
	csrfToken?: string;
}

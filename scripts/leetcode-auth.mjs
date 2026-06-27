/**
 * Fill LEETCODE_SESSION + CSRF_TOKEN in `.env` straight from a logged-in
 * Google Chrome session — no DevTools, no copy-paste.
 *
 * How it works (Linux):
 *  1. Copies Chrome's locked "Cookies" SQLite DB to a temp file and reads the
 *     leetcode.com rows with the built-in `node:sqlite`.
 *  2. Chrome encrypts cookie values. The AES key is derived from a password:
 *       - "v11" cookies  -> password lives in the GNOME keyring; we fetch it
 *         over the Secret Service D-Bus API (a single persistent connection).
 *       - "v10" cookies  -> the hardcoded fallback password "peanuts".
 *  3. Decrypts the two cookies (AES-128-CBC) and writes them into `.env`,
 *     preserving every other line.
 *
 * Run via:  pnpm leetcode:auth   (adds the needed node flags)
 */
import crypto from "node:crypto";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { DatabaseSync } from "node:sqlite";
import dbus from "dbus-next";

const COOKIE_NAMES = { LEETCODE_SESSION: "LEETCODE_SESSION", csrftoken: "CSRF_TOKEN" };

/** Candidate Chrome cookie-store locations, in priority order. */
function cookieDbCandidates() {
	const home = homedir();
	const profile = process.env["LEETCODE_AUTH_PROFILE"] ?? "Default";
	return [
		join(home, ".config/google-chrome", profile, "Cookies"),
		join(home, ".config/chromium", profile, "Cookies"),
		join(home, ".config/google-chrome", profile, "Network/Cookies"),
		join(home, ".config/chromium", profile, "Network/Cookies"),
	];
}

function findCookieDb() {
	const found = cookieDbCandidates().find((path) => existsSync(path));
	if (!found) {
		throw new Error(
			"Could not find a Chrome/Chromium cookie store. Is Chrome installed " +
				"and have you opened it at least once?\nLooked in:\n  " +
				cookieDbCandidates().join("\n  ")
		);
	}
	return found;
}

/** Fetch the "Chrome Safe Storage" password from the GNOME keyring via D-Bus. */
async function getKeyringPassword() {
	const bus = dbus.sessionBus();
	try {
		const root = await bus.getProxyObject(
			"org.freedesktop.secrets",
			"/org/freedesktop/secrets"
		);
		const service = root.getInterface("org.freedesktop.Secret.Service");
		// "plain" algorithm => GetSecret returns the password in cleartext.
		const [, session] = await service.OpenSession("plain", new dbus.Variant("s", ""));

		let [unlocked, locked] = await service.SearchItems({ application: "chrome" });
		if (unlocked.length === 0 && locked.length > 0) {
			// Keyring is locked — ask the daemon to unlock (may pop a prompt).
			await service.Unlock(locked);
			[unlocked] = await service.SearchItems({ application: "chrome" });
		}
		if (unlocked.length === 0) {
			throw new Error(
				"Chrome's keyring entry is locked or missing. Unlock your login " +
					"keyring (log into the desktop session) and retry."
			);
		}
		const itemObject = await bus.getProxyObject("org.freedesktop.secrets", unlocked[0]);
		const item = itemObject.getInterface("org.freedesktop.Secret.Item");
		const secret = await item.GetSecret(session); // [session, params, value, contentType]
		return Buffer.from(secret[2]).toString("utf8");
	} finally {
		bus.disconnect();
	}
}

const IV = Buffer.alloc(16, 0x20); // Chrome uses 16 spaces as the IV.

function deriveKey(password) {
	return crypto.pbkdf2Sync(password, "saltysalt", 1, 16, "sha1");
}

function decryptCookie(encrypted, keyV10, keyV11) {
	const version = encrypted.subarray(0, 3).toString("utf8");
	const key = version === "v10" ? keyV10 : keyV11;
	if (!key) {
		throw new Error(
			`Cookie uses ${version} encryption but its key is unavailable.`
		);
	}
	const decipher = crypto.createDecipheriv("aes-128-cbc", key, IV);
	decipher.setAutoPadding(false);
	let out = Buffer.concat([decipher.update(encrypted.subarray(3)), decipher.final()]);
	const pad = out[out.length - 1]; // strip PKCS#7 padding
	if (pad > 0 && pad <= 16) out = out.subarray(0, out.length - pad);
	// Chrome v130+ prepends a 32-byte SHA-256 domain hash to the plaintext.
	if (out.length > 32) {
		const tail = out.subarray(32).toString("utf8");
		if (/^[\x20-\x7e]+$/.test(tail)) return tail;
	}
	return out.toString("utf8");
}

/** Read+decrypt the two leetcode cookies from a copy of the locked DB. */
async function readCookies(dbPath) {
	const temporary = join(mkdtempSync(join(tmpdir(), "lc-auth-")), "Cookies");
	copyFileSync(dbPath, temporary);
	const db = new DatabaseSync(temporary, { readOnly: true });
	const rows = db
		.prepare(
			"SELECT name, encrypted_value FROM cookies " +
				"WHERE host_key IN ('leetcode.com', '.leetcode.com') " +
				"AND name IN ('LEETCODE_SESSION', 'csrftoken')"
		)
		.all();
	db.close();

	const needsV11 = rows.some(
		(row) => Buffer.from(row.encrypted_value).subarray(0, 3).toString() === "v11"
	);
	const keyV10 = deriveKey("peanuts");
	let keyV11 = null;
	if (needsV11) {
		keyV11 = deriveKey(await getKeyringPassword());
	}

	const result = {};
	for (const row of rows) {
		const value = decryptCookie(Buffer.from(row.encrypted_value), keyV10, keyV11);
		result[row.name] = value;
	}
	return result;
}

/** Upsert KEY=value lines into `.env`, preserving everything else. */
function updateEnv(envPath, updates) {
	let lines = [];
	if (existsSync(envPath)) {
		lines = readFileSync(envPath, "utf8").split("\n");
	} else if (existsSync(`${envPath}.example`)) {
		lines = readFileSync(`${envPath}.example`, "utf8").split("\n");
	}
	for (const [key, value] of Object.entries(updates)) {
		const index = lines.findIndex((line) => line.match(new RegExp(`^\\s*${key}\\s*=`)));
		const next = `${key}=${value}`;
		if (index === -1) {
			lines.push(next);
		} else {
			lines[index] = next;
		}
	}
	writeFileSync(envPath, lines.join("\n"));
}

async function main() {
	if (process.platform !== "linux") {
		console.error(
			`Auto-pull currently supports Linux + Chrome only (found ${process.platform}).\n` +
				"Use the manual route: copy LEETCODE_SESSION and csrftoken from DevTools →\n" +
				"Application → Cookies → https://leetcode.com into your .env."
		);
		process.exit(1);
	}

	const dbPath = findCookieDb();
	console.log(`Reading cookies from Chrome (${dbPath})…`);
	const cookies = await readCookies(dbPath);

	const missing = Object.keys(COOKIE_NAMES).filter((name) => !cookies[name]);
	if (missing.length > 0) {
		console.error(
			`Missing cookie(s): ${missing.join(", ")}.\n` +
				"Log into https://leetcode.com in Chrome, then run this again."
		);
		process.exit(1);
	}

	const envPath = join(process.cwd(), ".env");
	updateEnv(envPath, {
		LEETCODE_SESSION: cookies.LEETCODE_SESSION,
		CSRF_TOKEN: cookies.csrftoken,
	});

	console.log(
		`✓ Wrote LEETCODE_SESSION (${cookies.LEETCODE_SESSION.length} chars) and ` +
			`CSRF_TOKEN (${cookies.csrftoken.length} chars) to ${envPath}`
	);
	console.log("Restart the server to pick up the new credentials.");
}

main().catch((error) => {
	console.error(`✗ ${error.message}`);
	process.exit(1);
});

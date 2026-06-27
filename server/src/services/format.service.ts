import { spawn } from "node:child_process";
import { format as prettierFormat } from "prettier";
import { env } from "../config/env";

const TIMEOUT_MS = 10_000;

/** Error carrying an HTTP status for the controller to map onto the response. */
export class FormatError extends Error {
	public readonly statusCode: number;

	public constructor(message: string, statusCode = 400) {
		super(message);
		this.name = "FormatError";
		this.statusCode = statusCode;
	}
}

/** An external CLI formatter that reads source from stdin and writes to stdout. */
interface ExternalFormatter {
	cmd: string;
	args: string[];
	/** Hint shown when the binary is not installed. */
	install: string;
}

/** Maps a LeetCode `langSlug` to its external formatter (non JS/TS languages). */
function externalFormatterFor(lang: string): ExternalFormatter | null {
	switch (lang) {
		case "python":
		case "python3":
		case "pythondata":
			return { cmd: "black", args: ["-q", "-"], install: "pip install black" };
		case "cpp":
			return {
				cmd: "clang-format",
				args: ["--assume-filename=solution.cpp"],
				install: "install clang-format (e.g. apt install clang-format)",
			};
		case "c":
			return {
				cmd: "clang-format",
				args: ["--assume-filename=solution.c"],
				install: "install clang-format (e.g. apt install clang-format)",
			};
		case "java":
			if (!env.GOOGLE_JAVA_FORMAT_JAR) {
				return null;
			}
			return {
				cmd: "java",
				args: ["-jar", env.GOOGLE_JAVA_FORMAT_JAR, "-"],
				install: "set GOOGLE_JAVA_FORMAT_JAR to the google-java-format jar path",
			};
		default:
			return null;
	}
}

/** Prettier parser for the JS/TS family, or null if not a Prettier language. */
function prettierParserFor(lang: string): "typescript" | "babel" | null {
	if (lang === "typescript") return "typescript";
	if (lang === "javascript") return "babel";
	return null;
}

/** Spawns an external formatter, piping `input` through stdin → stdout. */
function runExternal(
	formatter: ExternalFormatter,
	input: string
): Promise<string> {
	return new Promise((resolve, reject) => {
		const child = spawn(formatter.cmd, formatter.args, {
			stdio: ["pipe", "pipe", "pipe"],
		});

		let stdout = "";
		let stderr = "";
		const timer = setTimeout(() => {
			child.kill("SIGKILL");
			reject(new FormatError(`${formatter.cmd} timed out`, 504));
		}, TIMEOUT_MS);

		child.stdout.on("data", (chunk: Buffer) => {
			stdout += chunk.toString();
		});
		child.stderr.on("data", (chunk: Buffer) => {
			stderr += chunk.toString();
		});

		child.on("error", (error: NodeJS.ErrnoException) => {
			clearTimeout(timer);
			if (error.code === "ENOENT") {
				reject(
					new FormatError(
						`Formatter "${formatter.cmd}" is not installed on the server. ` +
							`To enable it: ${formatter.install}.`,
						501
					)
				);
				return;
			}
			reject(new FormatError(`${formatter.cmd} failed: ${error.message}`, 500));
		});

		child.on("close", (code) => {
			clearTimeout(timer);
			if (code === 0) {
				resolve(stdout);
				return;
			}
			reject(
				new FormatError(
					stderr.trim() || `${formatter.cmd} exited with code ${code}`,
					422
				)
			);
		});

		child.stdin.on("error", () => {
			/* ignore EPIPE when the formatter exits early */
		});
		child.stdin.end(input);
	});
}

export interface FormatInput {
	lang: string;
	code: string;
}

/** Format `code` using the appropriate formatter for `lang`. */
export async function formatCode({ lang, code }: FormatInput): Promise<string> {
	const parser = prettierParserFor(lang);
	if (parser) {
		try {
			return await prettierFormat(code, { parser });
		} catch (error) {
			throw new FormatError(
				error instanceof Error ? error.message : "Prettier failed",
				422
			);
		}
	}

	const external = externalFormatterFor(lang);
	if (external) {
		return runExternal(external, code);
	}

	throw new FormatError(`No formatter is available for "${lang}".`, 501);
}

import type { CodeSnippet } from "@shared";

/**
 * LeetCode `langSlug` → Monaco language id. Only typescript/javascript get the
 * semantic TS worker; the rest fall back to Monarch syntax highlighting, which
 * is exactly what we want for Java/C++/Python/etc.
 */
const LANG_TO_MONACO: Record<string, string> = {
	cpp: "cpp",
	java: "java",
	python: "python",
	python3: "python",
	c: "c",
	csharp: "csharp",
	javascript: "javascript",
	typescript: "typescript",
	php: "php",
	swift: "swift",
	kotlin: "kotlin",
	dart: "dart",
	golang: "go",
	ruby: "ruby",
	scala: "scala",
	rust: "rust",
	racket: "scheme",
	erlang: "plaintext",
	elixir: "plaintext",
	mysql: "sql",
	mssql: "sql",
	oraclesql: "sql",
	pythondata: "python",
	react: "typescript",
};

export function toMonacoLanguage(langSlug: string): string {
	return LANG_TO_MONACO[langSlug] ?? "plaintext";
}

// Preferred default language order when a problem first loads.
const PREFERRED = ["python3", "java", "cpp", "javascript", "typescript"];

/** Pick a sensible default snippet: a preferred language, else the first one. */
export function pickDefaultSnippet(
	snippets: Array<CodeSnippet>
): CodeSnippet | undefined {
	for (const langSlug of PREFERRED) {
		const match = snippets.find((s) => s.langSlug === langSlug);
		if (match) {
			return match;
		}
	}
	return snippets[0];
}

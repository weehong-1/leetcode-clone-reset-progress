import type { ApiResponse } from "@shared";

/**
 * Thin fetch wrapper for the backend API. Calls are same-origin (`/api/...`),
 * forwarded to the Express server by the Vite dev proxy (and served by the same
 * origin in the production build). Unwraps the `ApiResponse<T>` envelope and
 * throws on `{ success: false }` so TanStack Query routes it to `isError`.
 *
 * No client-side timeout: run/submit block server-side while the LeetCode judge
 * is polled (up to ~60s), which is the intended behaviour.
 */
export async function apiFetch<T>(
	path: string,
	init?: RequestInit
): Promise<T> {
	const response = await fetch(`/api${path}`, {
		headers: { "Content-Type": "application/json" },
		...init,
	});

	let payload: ApiResponse<T>;
	try {
		payload = (await response.json()) as ApiResponse<T>;
	} catch {
		throw new Error(`Request failed (${response.status} ${response.statusText})`);
	}

	if (!payload.success) {
		throw new Error(payload.error);
	}
	return payload.data;
}

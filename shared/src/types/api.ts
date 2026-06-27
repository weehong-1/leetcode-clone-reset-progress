/**
 * Generic API response envelope shared between the client and server so both
 * sides agree on the success/error contract for `/api/*` endpoints.
 */
export type ApiResponse<T> =
	| { success: true; data: T }
	| { success: false; error: string };

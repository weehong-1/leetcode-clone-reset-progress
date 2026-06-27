/**
 * Shape of the `GET /api/health` payload. Lives in `shared` so the frontend can
 * type the health probe response without duplicating the contract.
 */
export type DatabaseState =
	| "disconnected"
	| "connected"
	| "connecting"
	| "disconnecting"
	| "unknown";

export interface HealthResponse {
	status: "ok";
	service: string;
	database: DatabaseState;
	timestamp: string;
}

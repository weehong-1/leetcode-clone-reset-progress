/** Error carrying an HTTP status for the controller to map onto the response. */
export class ListError extends Error {
	public readonly statusCode: number;

	public constructor(message: string, statusCode = 500) {
		super(message);
		this.name = "ListError";
		this.statusCode = statusCode;
	}
}

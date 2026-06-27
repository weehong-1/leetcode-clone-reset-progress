import { Router } from "express";
import {
	createSnapshotHandler,
	deleteSubmissionHandler,
	listSubmissionsHandler,
	updateSubmissionHandler,
} from "../controllers/submissions.controller";

export const submissionsRouter = Router();

// Per-problem history list (?slug=...) and manual snapshot creation.
submissionsRouter.get("/", listSubmissionsHandler);
submissionsRouter.post("/", createSnapshotHandler);

// Edit name/note or delete a single entry.
submissionsRouter.patch("/:id", updateSubmissionHandler);
submissionsRouter.delete("/:id", deleteSubmissionHandler);

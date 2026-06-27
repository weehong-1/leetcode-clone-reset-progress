import { Router } from "express";
import {
	addProblemHandler,
	createListHandler,
	deleteListHandler,
	getListHandler,
	getListsHandler,
	removeProblemHandler,
	renameListHandler,
} from "../controllers/lists.controller";

export const listsRouter = Router();

// Catalog: built-in curated lists (Blind 75, Grind 75, Top Interview 150,
// Top 100 Liked) plus user-created custom lists. Curated lists are read-only;
// custom lists are persisted in MongoDB and editable.
listsRouter.get("/", getListsHandler);
listsRouter.post("/", createListHandler);

// One list with its ordered problems. Must follow "/" so it isn't shadowed.
listsRouter.get("/:id", getListHandler);
listsRouter.patch("/:id", renameListHandler);
listsRouter.delete("/:id", deleteListHandler);

// Custom-list membership.
listsRouter.post("/:id/problems", addProblemHandler);
listsRouter.delete("/:id/problems/:slug", removeProblemHandler);

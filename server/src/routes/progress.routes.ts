import { Router } from "express";
import { resetProgressHandler } from "../controllers/progress.controller";

export const progressRouter = Router();

// Reset progress for the main problem list. Problems that belong to a saved
// list (curated or custom) are preserved; per-list resets happen on the list.
progressRouter.post("/reset", resetProgressHandler);

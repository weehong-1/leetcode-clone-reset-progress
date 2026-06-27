import { Router } from "express";
import { formatHandler } from "../controllers/format.controller";

export const formatRouter = Router();

// Reformat a code string with the appropriate formatter for its language.
formatRouter.post("/", formatHandler);

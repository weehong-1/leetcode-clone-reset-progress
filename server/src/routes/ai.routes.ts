import { Router } from "express";
import {
	tutorChatHandler,
	validateComplexityHandler,
} from "../controllers/ai.controller";

export const aiRouter = Router();

aiRouter.post("/validate-complexity", validateComplexityHandler);
aiRouter.post("/chat", tutorChatHandler);

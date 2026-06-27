import { Router } from "express";
import {
	getProblemHandler,
	getProblemListHandler,
	runHandler,
	submitHandler,
} from "../controllers/leetcode.controller";

export const leetcodeRouter = Router();

// Problem set listing (public GraphQL proxy). Must precede the `:slug` route
// so "/problems" isn't captured as a slug.
leetcodeRouter.get("/problems", getProblemListHandler);

// Problem detail (public GraphQL proxy).
leetcodeRouter.get("/problems/:slug", getProblemHandler);

// Run against example tests / submit against all tests (authenticated).
// Both block until the backend has polled the LeetCode judge to completion.
leetcodeRouter.post("/problems/:slug/run", runHandler);
leetcodeRouter.post("/problems/:slug/submit", submitHandler);

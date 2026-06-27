import { Router } from "express";
import {
	getSettingsHandler,
	updateSettingsHandler,
} from "../controllers/settings.controller";

export const settingsRouter = Router();

settingsRouter.get("/", getSettingsHandler);
settingsRouter.patch("/", updateSettingsHandler);

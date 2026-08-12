import { Router } from "express";
import { listVoicesHandler, previewVoiceHandler } from "../controllers/voicesController.js";

export const voicesRouter = Router();

voicesRouter.get("/voices", listVoicesHandler);
voicesRouter.post("/voices/preview", previewVoiceHandler);

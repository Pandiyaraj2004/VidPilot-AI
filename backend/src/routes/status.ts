import { Router } from "express";
import { getSystemStatus } from "../controllers/statusController.js";

export const statusRouter = Router();

statusRouter.get("/status", getSystemStatus);

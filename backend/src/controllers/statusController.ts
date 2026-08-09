import type { Request, Response } from "express";
import { config, isConfigured } from "../config/env.js";
import { isFirebaseConfigured } from "../services/firebase/index.js";
import type { SystemStatus } from "../types/index.js";

export function getSystemStatus(_req: Request, res: Response): void {
  const status: SystemStatus = {
    vidpilot: "operational",
    database: isFirebaseConfigured() ? "connected" : "disconnected",
    automation: "not_configured",
    telegram: isConfigured(config.telegram.botToken) ? "connected" : "not_connected",
    youtube: isConfigured(config.youtube.refreshToken) ? "connected" : "not_connected",
  };

  res.json(status);
}

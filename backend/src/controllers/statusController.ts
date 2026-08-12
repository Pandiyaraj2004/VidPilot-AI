import type { Request, Response } from "express";
import { config, isConfigured } from "../config/env.js";
import { isFirebaseConfigured } from "../services/firebase/index.js";
import { youtubeProvider } from "../services/youtube/index.js";
import type { SystemStatus } from "../types/index.js";

export async function getSystemStatus(_req: Request, res: Response, next: (err?: unknown) => void): Promise<void> {
  try {
    const youtubeConnected = await youtubeProvider.isConnected();
    const status: SystemStatus = {
      vidpilot: "operational",
      database: isFirebaseConfigured() ? "connected" : "disconnected",
      automation: "not_configured",
      telegram: isConfigured(config.telegram.botToken) && isConfigured(config.telegram.chatId) ? "connected" : "not_connected",
      youtube: youtubeConnected ? "connected" : "not_connected",
    };

    res.json(status);
  } catch (err) {
    next(err);
  }
}

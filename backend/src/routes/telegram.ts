import { Router } from "express";
import { config } from "../config/env.js";
import { telegramProvider } from "../services/telegram/index.js";
import { handleTelegramUpdate } from "../services/telegram/telegramUpdateHandler.js";
import type { TelegramUpdate } from "../services/telegram/telegramProvider.js";

export const telegramRouter = Router();

/**
 * Real production transport (Phase 10) — only reachable if this server is
 * ever given a public HTTPS URL and `setWebhook` is called with it. Local
 * dev instead relies on telegramPoller.ts's long-poll loop, started from
 * server.ts. Validated the same way Telegram itself recommends: a shared
 * secret echoed back on every request via this header, checked before
 * anything in the body is trusted.
 */
telegramRouter.post("/telegram/webhook", (req, res) => {
  const secret = req.header("X-Telegram-Bot-Api-Secret-Token");
  if (!config.telegram.webhookSecret || secret !== config.telegram.webhookSecret) {
    res.status(401).json({ error: "Invalid webhook secret." });
    return;
  }

  res.status(200).end();

  void handleTelegramUpdate(req.body as TelegramUpdate, telegramProvider).catch((err) => {
    // eslint-disable-next-line no-console
    console.error("[telegram] Error handling webhook update:", err);
  });
});

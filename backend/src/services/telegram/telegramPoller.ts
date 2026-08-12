/**
 * Long-poll transport (Phase 10) — the practical primary way this app
 * receives real Telegram button-taps in local dev, since a real webhook
 * needs a public HTTPS URL this environment doesn't have. Runs a
 * `getUpdates` loop from server startup for as long as Telegram is
 * configured; each update is fed through the same handleTelegramUpdate
 * core the webhook route uses.
 */

import { config } from "../../config/env.js";
import { telegramProvider } from "./index.js";
import { handleTelegramUpdate } from "./telegramUpdateHandler.js";

const POLL_TIMEOUT_SECONDS = 30;
const ERROR_BACKOFF_MS = 5000;

let polling = false;
let offset = 0;

async function pollLoop(): Promise<void> {
  while (polling) {
    try {
      const updates = await telegramProvider.getUpdates(offset, POLL_TIMEOUT_SECONDS);
      for (const update of updates) {
        offset = update.update_id + 1;
        try {
          await handleTelegramUpdate(update, telegramProvider);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error(`[telegram] Error handling update ${update.update_id}:`, err);
        }
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[telegram] getUpdates failed, retrying shortly:", err instanceof Error ? err.message : err);
      await new Promise((resolve) => setTimeout(resolve, ERROR_BACKOFF_MS));
    }
  }
}

export function startTelegramPolling(): void {
  if (polling || !telegramProvider.isConfigured()) return;
  polling = true;
  // eslint-disable-next-line no-console
  console.log(`[telegram] Long-polling started for chat ${config.telegram.chatId}.`);
  void pollLoop();
}

export function stopTelegramPolling(): void {
  polling = false;
}

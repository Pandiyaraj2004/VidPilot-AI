/**
 * Single shared TelegramBotProvider instance — everything in this app that
 * talks to Telegram (sendApproval.ts, telegramUpdateHandler.ts,
 * telegramPoller.ts) imports the same instance from here rather than
 * constructing its own, matching the singleton pattern already used for
 * jobRepository (services/jobs/index.ts).
 */

import { TelegramBotProvider } from "./bot.js";
import type { TelegramProvider } from "./telegramProvider.js";

export const telegramProvider: TelegramProvider = new TelegramBotProvider();

/**
 * Real Telegram Bot API client (Phase 10) — replaces the Phase-7-era
 * throwing placeholder that used to live in this file. Plain `fetch`
 * against `https://api.telegram.org/bot<token>/...`, no SDK dependency —
 * same "hand-rolled HTTP client, no new package for something this small"
 * convention already used for Jamendo/Pixabay/Pexels
 * (services/visual/providers/httpClient.ts).
 *
 * The bot token/chat id never leave the backend process — nothing here is
 * ever serialized into an API response sent to the frontend.
 */

import { readFile } from "node:fs/promises";
import { config, isConfigured } from "../../config/env.js";
import type {
  InlineKeyboardButton,
  SendMessageOptions,
  SendVideoWithApprovalInput,
  TelegramProvider,
  TelegramUpdate,
} from "./telegramProvider.js";

export class TelegramApiError extends Error {}

const API_BASE = "https://api.telegram.org";
const REQUEST_TIMEOUT_MS = 30000;
// Video uploads can be large (up to 50 MB) and Telegram's CDN can be slow
// — 5 minutes is a generous but necessary ceiling for real-world uploads.
const VIDEO_UPLOAD_TIMEOUT_MS = 300000;
// getUpdates itself blocks server-side for up to this many seconds waiting
// for a new update (Telegram's own long-poll mechanism) — the HTTP client
// timeout has to be comfortably longer than that or every idle poll would
// look like a timeout.
const POLL_HTTP_TIMEOUT_MS = 35000;

interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
}

function toInlineKeyboard(buttons: InlineKeyboardButton[][]): { inline_keyboard: InlineKeyboardButton[][] } {
  return { inline_keyboard: buttons };
}

export class TelegramBotProvider implements TelegramProvider {
  isConfigured(): boolean {
    return isConfigured(config.telegram.botToken) && isConfigured(config.telegram.chatId);
  }

  private apiUrl(method: string): string {
    return `${API_BASE}/bot${config.telegram.botToken}/${method}`;
  }

  private async callJson<T>(method: string, body: Record<string, unknown>, timeoutMs = REQUEST_TIMEOUT_MS): Promise<T> {
    if (!this.isConfigured()) {
      throw new TelegramApiError("Telegram approval is not configured (missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID).");
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(this.apiUrl(method), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const parsed = (await response.json()) as TelegramApiResponse<T>;
      if (!response.ok || !parsed.ok) {
        throw new TelegramApiError(`Telegram API ${method} failed: ${parsed.description ?? response.statusText}`);
      }
      return parsed.result as T;
    } catch (err) {
      if (err instanceof TelegramApiError) throw err;
      if (err instanceof Error && err.name === "AbortError") {
        throw new TelegramApiError(`Telegram API ${method} timed out after ${timeoutMs}ms.`);
      }
      throw new TelegramApiError(`Telegram API ${method} failed: ${(err as Error).message}`);
    } finally {
      clearTimeout(timer);
    }
  }

  async sendVideoWithApproval(input: SendVideoWithApprovalInput): Promise<{ messageId: number }> {
    if (!this.isConfigured()) {
      throw new TelegramApiError("Telegram approval is not configured (missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID).");
    }
    let buffer: Buffer;
    try {
      buffer = await readFile(input.videoPath);
    } catch (err) {
      throw new TelegramApiError(`Could not read the video file to send: ${(err as Error).message}`);
    }

    const form = new FormData();
    form.set("chat_id", input.chatId);
    form.set("caption", input.caption);
    form.set("reply_markup", JSON.stringify(toInlineKeyboard(input.buttons)));
    form.set("supports_streaming", "true");
    form.set("video", new Blob([buffer]), "video.mp4");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), VIDEO_UPLOAD_TIMEOUT_MS);
    try {
      const response = await fetch(this.apiUrl("sendVideo"), { method: "POST", body: form, signal: controller.signal });
      const parsed = (await response.json()) as TelegramApiResponse<{ message_id: number }>;
      if (!response.ok || !parsed.ok || !parsed.result) {
        throw new TelegramApiError(`Telegram sendVideo failed: ${parsed.description ?? response.statusText}`);
      }
      return { messageId: parsed.result.message_id };
    } catch (err) {
      if (err instanceof TelegramApiError) throw err;
      if (err instanceof Error && err.name === "AbortError") {
      throw new TelegramApiError(`Telegram sendVideo timed out after ${VIDEO_UPLOAD_TIMEOUT_MS / 1000}s.`);
      }
      throw new TelegramApiError(`Telegram sendVideo failed: ${(err as Error).message}`);
    } finally {
      clearTimeout(timer);
    }
  }

  async sendMessage(chatId: string, text: string, options?: SendMessageOptions): Promise<{ messageId: number }> {
    const reply_markup = options?.buttons
      ? toInlineKeyboard(options.buttons)
      : options?.forceReply
        ? { force_reply: true }
        : undefined;
    const result = await this.callJson<{ message_id: number }>("sendMessage", {
      chat_id: chatId,
      text,
      ...(reply_markup ? { reply_markup } : {}),
    });
    return { messageId: result.message_id };
  }

  async editMessageReplyMarkup(chatId: string, messageId: number, buttons: InlineKeyboardButton[][] | null): Promise<void> {
    await this.callJson("editMessageReplyMarkup", {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: buttons ? toInlineKeyboard(buttons) : { inline_keyboard: [] },
    });
  }

  async answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
    await this.callJson("answerCallbackQuery", { callback_query_id: callbackQueryId, ...(text ? { text } : {}) });
  }

  async getUpdates(offset: number, timeoutSeconds: number): Promise<TelegramUpdate[]> {
    const result = await this.callJson<TelegramUpdate[]>(
      "getUpdates",
      { offset, timeout: timeoutSeconds, allowed_updates: ["message", "callback_query"] },
      POLL_HTTP_TIMEOUT_MS
    );
    return result ?? [];
  }

  async setWebhook(url: string, secretToken: string): Promise<void> {
    await this.callJson("setWebhook", { url, secret_token: secretToken, allowed_updates: ["message", "callback_query"] });
  }

  async deleteWebhook(): Promise<void> {
    await this.callJson("deleteWebhook", {});
  }
}

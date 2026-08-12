/**
 * Backend-only Telegram provider abstraction (Phase 10) — mirrors the
 * project's existing VisualProvider/VoiceProvider pattern: the approval
 * workflow (telegramUpdateHandler.ts, jobService.ts) depends only on this
 * interface, never on Telegram's raw HTTP API directly. TelegramBotProvider
 * (bot.ts) is the one real implementation.
 */

export interface InlineKeyboardButton {
  text: string;
  callback_data: string;
}

export interface SendVideoWithApprovalInput {
  chatId: string;
  videoPath: string;
  caption: string;
  buttons: InlineKeyboardButton[][];
}

export interface SendMessageOptions {
  buttons?: InlineKeyboardButton[][];
  /** Telegram's own ForceReply markup — the next plain-text message the user sends in this chat arrives with `reply_to_message` pointing at this prompt, letting the handler correlate a free-text reply back to a specific job. */
  forceReply?: boolean;
}

/** The minimal slice of a real Telegram Update object this app actually reads — not the full Bot API schema. */
export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number | string };
    text?: string;
    reply_to_message?: { message_id: number };
  };
  callback_query?: {
    id: string;
    data?: string;
    message?: { message_id: number; chat: { id: number | string } };
    from?: { id: number };
  };
}

export interface TelegramProvider {
  isConfigured(): boolean;
  /** Sends the actual rendered MP4 with a caption and inline Approve/Reject buttons. Returns the real message id Telegram assigns. */
  sendVideoWithApproval(input: SendVideoWithApprovalInput): Promise<{ messageId: number }>;
  sendMessage(chatId: string, text: string, options?: SendMessageOptions): Promise<{ messageId: number }>;
  /** Removes/replaces a message's inline keyboard — used right after a decision so a second tap on an old message can't do anything. */
  editMessageReplyMarkup(chatId: string, messageId: number, buttons: InlineKeyboardButton[][] | null): Promise<void>;
  /** Every callback query must be answered or Telegram shows the user a perpetual loading spinner on the button. */
  answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void>;
  /** Long-poll transport (telegramPoller.ts) — returns new updates since `offset`. */
  getUpdates(offset: number, timeoutSeconds: number): Promise<TelegramUpdate[]>;
  setWebhook(url: string, secretToken: string): Promise<void>;
  deleteWebhook(): Promise<void>;
}

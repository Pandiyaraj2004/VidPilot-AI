export interface TelegramConnectionInfo {
  connected: boolean;
  botConfigured: boolean;
  chatConfigured: boolean;
}

/** Telegram bot approval-gateway placeholder — ships in Phase 7. */
export const telegramService = {
  async getConnectionInfo(): Promise<TelegramConnectionInfo> {
    return { connected: false, botConfigured: false, chatConfigured: false };
  },

  async connect(): Promise<void> {
    throw new Error("Telegram integration is not connected yet. It ships in Phase 7.");
  },
};

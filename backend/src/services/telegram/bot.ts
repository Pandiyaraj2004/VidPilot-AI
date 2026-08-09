export interface ApprovalRequestMessage {
  jobId: string;
  title: string;
  durationSeconds: number;
  qualityScore: number;
}

/**
 * Placeholder for the Telegram bot approval gateway (Phase 7).
 */
export class TelegramBotService {
  async sendApprovalRequest(_message: ApprovalRequestMessage): Promise<void> {
    throw new Error(
      "TelegramBotService.sendApprovalRequest() is not implemented yet. Ships in Phase 7."
    );
  }
}

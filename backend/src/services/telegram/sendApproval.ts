/**
 * Sends a real Telegram approval request for a job (Phase 10) — the one
 * place that ties jobService's state guards together with an actual
 * provider call. jobService.ts itself stays Telegram-free (it only knows
 * about JobStatus/JobApproval); this file is the seam: validate → call the
 * real API → only persist "sent" state after the call actually succeeds.
 */

import { config } from "../../config/env.js";
import { HttpError, ValidationError } from "../../utils/errors.js";
import * as jobService from "../jobs/jobService.js";
import type { VideoJob } from "../../types/index.js";
import { buildApprovalCaption } from "./approvalMessage.js";
import { buildApprovalButtons } from "./callbackData.js";
import { telegramProvider } from "./index.js";
import { ensureLocalVideoFile } from "../video/videoStorage.js";
import { SchedulerLock } from "../scheduler/schedulerLock.js";

export interface SendApprovalOptions {
  /** When true, sends a fresh Telegram message for a job already awaiting approval (manual UI only). */
  resend?: boolean;
}

export async function sendApprovalRequestForJob(id: string, options: SendApprovalOptions = {}): Promise<VideoJob> {
  const lock = new SchedulerLock();
  const lockKey = `approval-send:${id}`;
  const acquired = await lock.acquire(lockKey);
  if (!acquired) {
    throw new ValidationError("A Telegram approval send is already in progress for this job.");
  }

  try {
    const job = options.resend
      ? await jobService.prepareApprovalResend(id)
      : await jobService.prepareApprovalSend(id);

    if (!telegramProvider.isConfigured()) {
      throw new ValidationError("Telegram approval is not configured (missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID).");
    }

    const localVideoPath = await ensureLocalVideoFile(job.id, job.videoRender!.path!);

    const nextVersion = (job.approval?.version ?? 0) + 1;
    const caption = buildApprovalCaption(job);
    const buttons = buildApprovalButtons(job.id, nextVersion);

    try {
      const { messageId } = await telegramProvider.sendVideoWithApproval({
        chatId: config.telegram.chatId!,
        videoPath: localVideoPath,
        caption,
        buttons,
      });
      return await jobService.recordApprovalSent(id, messageId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unexpected error sending the Telegram approval request.";
      throw new HttpError(502, `Could not send this video for Telegram approval: ${message}`);
    }
  } finally {
    await lock.release(lockKey);
  }
}

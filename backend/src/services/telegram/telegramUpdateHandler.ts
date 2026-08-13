/**
 * Transport-agnostic Telegram update handler (Phase 10) — both the
 * long-poll loop (telegramPoller.ts) and the real webhook route
 * (routes/telegram.ts) feed every update through this single function, so
 * the actual approval logic is tested and reasoned about in one place
 * regardless of which transport delivered the update.
 *
 * Security model: every callback/message is checked against the one
 * configured chat id before anything else runs. Job state + approval
 * version are re-validated on every action via jobService's
 * checkApprovalPreconditions (through approveJob/rejectJob/
 * recordPendingRejectionPrompt) — never trusted from the callback payload
 * alone. A callback query is always answered (Telegram shows an infinite
 * spinner on the button otherwise), and a terminal decision always removes
 * the message's buttons so a second tap can never do anything.
 */

import { config } from "../../config/env.js";
import * as jobService from "../jobs/jobService.js";
import type { ApprovalActionFailureReason, ApprovalActionResult } from "../jobs/jobService.js";
import { QUICK_REASON_LABELS, buildQuickReasonButtons, parseCallbackData } from "./callbackData.js";
import type { TelegramProvider, TelegramUpdate } from "./telegramProvider.js";

const REASON_PROMPT_TEXT =
  "Please tell me why you're rejecting this video — reply to this message with your reason, or tap a quick reason below.";

function isAuthorizedChat(chatId: number | string | undefined): boolean {
  return chatId != null && String(chatId) === config.telegram.chatId;
}

function describeFailure(reason: ApprovalActionFailureReason): string {
  switch (reason) {
    case "not_found":
      return "Job not found.";
    case "not_awaiting_approval":
      return "This job is not awaiting approval anymore.";
    case "stale_version":
      return "This approval request has expired — tap Approve or Reject on the latest Telegram message for this video.";
    default:
      return "Could not process this action.";
  }
}

async function safely(fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
  } catch {
    // Best-effort notifications to Telegram (answerCallbackQuery, a follow-up
    // sendMessage) should never crash the update loop — the authoritative
    // job state is already persisted by the time these run.
  }
}

async function respondToDecision(
  result: ApprovalActionResult,
  provider: TelegramProvider,
  callbackQueryId: string,
  chatId: string,
  messageId: number,
  decisionLabel: "approved" | "rejected",
  reasonIfKnown?: string
): Promise<void> {
  if (!result.ok) {
    await safely(() => provider.answerCallbackQuery(callbackQueryId, describeFailure(result.reason)));
    return;
  }

  await safely(() =>
    provider.answerCallbackQuery(callbackQueryId, decisionLabel === "approved" ? "✅ Approved" : "❌ Rejected")
  );
  await safely(() => provider.editMessageReplyMarkup(chatId, messageId, null));

  const job = result.job;
  const title = job.content?.title ?? job.topic;
  const confirmation =
    decisionLabel === "approved"
      ? `✅ Approved:\n${title}\n\nThis job is now ready for the next stage.`
      : `❌ Rejected:\n${title}\n\nReason:\n${job.approval?.reason ?? reasonIfKnown ?? "(no reason recorded)"}`;
  await safely(() => provider.sendMessage(chatId, confirmation));
}

async function handleCallbackQuery(
  cq: NonNullable<TelegramUpdate["callback_query"]>,
  provider: TelegramProvider
): Promise<void> {
  const chatId = cq.message?.chat.id;
  // In a private 1:1 bot chat, Telegram's chat id and the user's own id are
  // the same number — this app only ever talks to one configured chat, so
  // checking both is a cheap extra layer, not a separate authorization
  // model.
  if (!isAuthorizedChat(chatId) || !isAuthorizedChat(cq.from?.id)) {
    await safely(() => provider.answerCallbackQuery(cq.id, "Unauthorized."));
    return;
  }

  const parsed = parseCallbackData(cq.data);
  if (!parsed || !cq.message) {
    await safely(() => provider.answerCallbackQuery(cq.id, "Unrecognized action."));
    return;
  }

  const chatIdStr = String(chatId);
  const messageId = cq.message.message_id;

  try {
    if (parsed.type === "approve") {
      const result = await jobService.approveJob(parsed.jobId, parsed.version);
      await respondToDecision(result, provider, cq.id, chatIdStr, messageId, "approved");
      // If approved successfully, auto-trigger YouTube upload in the background
      if (result.ok) {
        (async () => {
          try {
            console.log(`[Telegram Auto-Upload] Triggering YouTube upload for approved job ${parsed.jobId}`);
            await jobService.uploadVideoForJob(parsed.jobId);
            await provider.sendMessage(chatIdStr, `🚀 Automatically uploaded to YouTube:\n${result.job.content?.title ?? result.job.topic}`);
          } catch (uploadErr) {
            console.error(`[Telegram Auto-Upload] YouTube upload failed for job ${parsed.jobId}:`, uploadErr);
            await provider.sendMessage(
              chatIdStr,
              `⚠️ Auto-upload to YouTube failed for job ${result.job.content?.title ?? result.job.topic}. Reason: ${uploadErr instanceof Error ? uploadErr.message : String(uploadErr)}`
            );
          }
        })();
      }
      return;
    }

    if (parsed.type === "reject") {
      const prompt = await provider.sendMessage(chatIdStr, REASON_PROMPT_TEXT, {
        forceReply: true,
        buttons: buildQuickReasonButtons(parsed.jobId, parsed.version),
      });
      const result = await jobService.recordPendingRejectionPrompt(parsed.jobId, parsed.version, prompt.messageId);
      if (!result.ok) {
        await safely(() => provider.answerCallbackQuery(cq.id, describeFailure(result.reason)));
        return;
      }
      await safely(() => provider.answerCallbackQuery(cq.id, "Please provide a reason."));
      return;
    }

    if (parsed.type === "reject_reason") {
      const reason = QUICK_REASON_LABELS[parsed.reasonCode];
      const result = await jobService.rejectJob(parsed.jobId, parsed.version, reason);
      await respondToDecision(result, provider, cq.id, chatIdStr, messageId, "rejected", reason);
      return;
    }
  } catch {
    // An unexpected failure (e.g. the job store being temporarily
    // unreachable) must still answer the callback query — otherwise
    // Telegram leaves the button spinning forever with no feedback, and
    // the job's state is left exactly as it was (nothing here has
    // persisted anything on this path yet).
    await safely(() => provider.answerCallbackQuery(cq.id, "Something went wrong — please try again in a moment."));
  }
}

async function handleReasonReply(message: NonNullable<TelegramUpdate["message"]>, provider: TelegramProvider): Promise<void> {
  if (!isAuthorizedChat(message.chat.id)) return;

  const replyToId = message.reply_to_message?.message_id;
  const text = message.text?.trim();
  if (!replyToId || !text) return;

  const chatIdStr = String(message.chat.id);

  try {
    const job = await jobService.findJobAwaitingReasonReply(replyToId);
    if (!job || !job.approval) return;

    const result = await jobService.rejectJob(job.id, job.approval.version, text);
    if (!result.ok) {
      await safely(() => provider.sendMessage(chatIdStr, describeFailure(result.reason)));
      return;
    }

    if (job.telegramMessageId) {
      await safely(() => provider.editMessageReplyMarkup(chatIdStr, Number(job.telegramMessageId), null));
    }
    await safely(() =>
      provider.sendMessage(
        chatIdStr,
        `❌ Rejected:\n${result.job.content?.title ?? result.job.topic}\n\nReason:\n${text}`
      )
    );
  } catch {
    // Same rationale as handleCallbackQuery's catch — a free-text reply has
    // no callback query to answer, but the user still typed something and
    // deserves to know it didn't go through, rather than silence.
    await safely(() => provider.sendMessage(chatIdStr, "Something went wrong recording that — please try again in a moment."));
  }
}

export async function handleTelegramUpdate(update: TelegramUpdate, provider: TelegramProvider): Promise<void> {
  if (update.callback_query) {
    await handleCallbackQuery(update.callback_query, provider);
    return;
  }
  if (update.message?.reply_to_message) {
    await handleReasonReply(update.message, provider);
  }
}

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VideoJob } from "../../types/index.js";
import type { TelegramProvider, TelegramUpdate } from "./telegramProvider.js";

vi.mock("../jobs/jobService.js", () => ({
  approveJob: vi.fn(),
  rejectJob: vi.fn(),
  recordPendingRejectionPrompt: vi.fn(),
  findJobAwaitingReasonReply: vi.fn(),
}));

function makeJob(): VideoJob {
  return {
    id: "job-1",
    topic: "Test topic",
    telegramMessageId: "555",
    content: { title: "Test Title" } as VideoJob["content"],
    approval: {
      status: "sent",
      version: 1,
      renderVersion: 1,
      sentAt: new Date(0).toISOString(),
      decision: null,
      reason: null,
      decidedAt: null,
      pendingReasonPromptMessageId: null,
    },
  } as VideoJob;
}

function makeProvider(): TelegramProvider {
  return {
    isConfigured: vi.fn().mockReturnValue(true),
    sendVideoWithApproval: vi.fn(),
    sendMessage: vi.fn().mockResolvedValue({ messageId: 999 }),
    editMessageReplyMarkup: vi.fn().mockResolvedValue(undefined),
    answerCallbackQuery: vi.fn().mockResolvedValue(undefined),
    getUpdates: vi.fn().mockResolvedValue([]),
    setWebhook: vi.fn(),
    deleteWebhook: vi.fn(),
  };
}

const CHAT_ID = 12345;

function callbackUpdate(data: string, messageId = 1): TelegramUpdate {
  return {
    update_id: 1,
    callback_query: {
      id: "cbq-1",
      data,
      message: { message_id: messageId, chat: { id: CHAT_ID } },
      from: { id: CHAT_ID },
    },
  };
}

function replyUpdate(text: string, replyToMessageId: number): TelegramUpdate {
  return {
    update_id: 2,
    message: {
      message_id: 10,
      chat: { id: CHAT_ID },
      text,
      reply_to_message: { message_id: replyToMessageId },
    },
  };
}

describe("handleTelegramUpdate", () => {
  let jobService: {
    approveJob: ReturnType<typeof vi.fn>;
    rejectJob: ReturnType<typeof vi.fn>;
    recordPendingRejectionPrompt: ReturnType<typeof vi.fn>;
    findJobAwaitingReasonReply: ReturnType<typeof vi.fn>;
  };
  let handleTelegramUpdate: typeof import("./telegramUpdateHandler.js")["handleTelegramUpdate"];
  let encodeApprove: typeof import("./callbackData.js")["encodeApprove"];
  let encodeReject: typeof import("./callbackData.js")["encodeReject"];
  let encodeQuickReason: typeof import("./callbackData.js")["encodeQuickReason"];

  beforeEach(async () => {
    vi.resetModules();
    process.env.TELEGRAM_CHAT_ID = String(CHAT_ID);
    vi.clearAllMocks();
    jobService = (await import("../jobs/jobService.js")) as never;
    ({ handleTelegramUpdate } = await import("./telegramUpdateHandler.js"));
    ({ encodeApprove, encodeReject, encodeQuickReason } = await import("./callbackData.js"));
  });

  describe("approve callback", () => {
    it("approves, answers the callback, removes the buttons, and confirms in chat", async () => {
      const job = makeJob();
      jobService.approveJob.mockResolvedValue({ ok: true, job });
      const provider = makeProvider();

      await handleTelegramUpdate(callbackUpdate(encodeApprove(job.id, 1), 77), provider);

      expect(jobService.approveJob).toHaveBeenCalledWith(job.id, 1);
      expect(provider.answerCallbackQuery).toHaveBeenCalledWith("cbq-1", expect.stringContaining("Approved"));
      expect(provider.editMessageReplyMarkup).toHaveBeenCalledWith(String(CHAT_ID), 77, null);
      expect(provider.sendMessage).toHaveBeenCalledWith(String(CHAT_ID), expect.stringContaining("Approved"));
    });

    it("tells the user the approval expired on a stale version, without touching the message", async () => {
      jobService.approveJob.mockResolvedValue({ ok: false, reason: "stale_version" });
      const provider = makeProvider();

      await handleTelegramUpdate(callbackUpdate(encodeApprove("job-1", 1), 77), provider);

      expect(provider.answerCallbackQuery).toHaveBeenCalledWith("cbq-1", expect.stringContaining("expired"));
      expect(provider.editMessageReplyMarkup).not.toHaveBeenCalled();
      expect(provider.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe("reject callback", () => {
    it("sends a force-reply reason prompt with quick-reason buttons and records its message id", async () => {
      const job = makeJob();
      jobService.recordPendingRejectionPrompt.mockResolvedValue({ ok: true, job });
      const provider = makeProvider();
      (provider.sendMessage as ReturnType<typeof vi.fn>).mockResolvedValue({ messageId: 321 });

      await handleTelegramUpdate(callbackUpdate(encodeReject(job.id, 1), 77), provider);

      expect(provider.sendMessage).toHaveBeenCalledWith(
        String(CHAT_ID),
        expect.stringContaining("reason"),
        expect.objectContaining({ forceReply: true })
      );
      expect(jobService.recordPendingRejectionPrompt).toHaveBeenCalledWith(job.id, 1, 321);
    });
  });

  describe("quick-reason callback", () => {
    it("rejects with the quick reason's human label, answers, and confirms", async () => {
      const job = makeJob();
      jobService.rejectJob.mockResolvedValue({ ok: true, job: { ...job, approval: { ...job.approval!, reason: "Captions" } } });
      const provider = makeProvider();

      await handleTelegramUpdate(callbackUpdate(encodeQuickReason(job.id, 1, "captions"), 77), provider);

      expect(jobService.rejectJob).toHaveBeenCalledWith(job.id, 1, "Captions");
      expect(provider.sendMessage).toHaveBeenCalledWith(String(CHAT_ID), expect.stringContaining("Captions"));
    });
  });

  describe("free-text reason reply", () => {
    it("correlates the reply to the right job via the prompt message id and rejects with the real text", async () => {
      const job = makeJob();
      jobService.findJobAwaitingReasonReply.mockResolvedValue(job);
      jobService.rejectJob.mockResolvedValue({ ok: true, job: { ...job, approval: { ...job.approval!, reason: "Voice sounds robotic" } } });
      const provider = makeProvider();

      await handleTelegramUpdate(replyUpdate("Voice sounds robotic", 321), provider);

      expect(jobService.findJobAwaitingReasonReply).toHaveBeenCalledWith(321);
      expect(jobService.rejectJob).toHaveBeenCalledWith(job.id, 1, "Voice sounds robotic");
      expect(provider.editMessageReplyMarkup).toHaveBeenCalledWith(String(CHAT_ID), 555, null);
      expect(provider.sendMessage).toHaveBeenCalledWith(String(CHAT_ID), expect.stringContaining("Voice sounds robotic"));
    });

    it("does nothing when no job is waiting on that prompt message id", async () => {
      jobService.findJobAwaitingReasonReply.mockResolvedValue(null);
      const provider = makeProvider();

      await handleTelegramUpdate(replyUpdate("some reply", 999), provider);

      expect(jobService.rejectJob).not.toHaveBeenCalled();
      expect(provider.sendMessage).not.toHaveBeenCalled();
    });

    it("ignores a plain message that isn't a reply to anything", async () => {
      const provider = makeProvider();
      await handleTelegramUpdate({ update_id: 3, message: { message_id: 4, chat: { id: CHAT_ID }, text: "hi" } }, provider);
      expect(jobService.findJobAwaitingReasonReply).not.toHaveBeenCalled();
    });
  });

  describe("security", () => {
    it("rejects a callback from an unauthorized chat without calling jobService at all", async () => {
      const provider = makeProvider();
      const update = callbackUpdate(encodeApprove("job-1", 1), 77);
      update.callback_query!.message!.chat.id = 99999;
      update.callback_query!.from!.id = 99999;

      await handleTelegramUpdate(update, provider);

      expect(jobService.approveJob).not.toHaveBeenCalled();
      expect(provider.answerCallbackQuery).toHaveBeenCalledWith("cbq-1", expect.stringContaining("Unauthorized"));
    });

    it("ignores a free-text reply from an unauthorized chat", async () => {
      const provider = makeProvider();
      const update = replyUpdate("hi", 321);
      update.message!.chat.id = 99999;

      await handleTelegramUpdate(update, provider);

      expect(jobService.findJobAwaitingReasonReply).not.toHaveBeenCalled();
    });

    it("ignores an unparseable callback_data payload", async () => {
      const provider = makeProvider();
      await handleTelegramUpdate(callbackUpdate("not-a-real-payload", 77), provider);

      expect(jobService.approveJob).not.toHaveBeenCalled();
      expect(jobService.rejectJob).not.toHaveBeenCalled();
      expect(provider.answerCallbackQuery).toHaveBeenCalledWith("cbq-1", expect.stringContaining("Unrecognized"));
    });
  });

  describe("resilience", () => {
    it("never throws even when answerCallbackQuery itself fails", async () => {
      const job = makeJob();
      jobService.approveJob.mockResolvedValue({ ok: true, job });
      const provider = makeProvider();
      (provider.answerCallbackQuery as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("network blip"));

      await expect(handleTelegramUpdate(callbackUpdate(encodeApprove(job.id, 1), 77), provider)).resolves.toBeUndefined();
    });

    it("still answers the callback query when the job store itself throws (e.g. a real Firestore quota outage)", async () => {
      jobService.approveJob.mockRejectedValue(new Error("8 RESOURCE_EXHAUSTED: Quota exceeded."));
      const provider = makeProvider();

      await handleTelegramUpdate(callbackUpdate(encodeApprove("job-1", 1), 77), provider);

      expect(provider.answerCallbackQuery).toHaveBeenCalledWith("cbq-1", expect.stringContaining("try again"));
      expect(provider.editMessageReplyMarkup).not.toHaveBeenCalled();
      expect(provider.sendMessage).not.toHaveBeenCalled();
    });

    it("still notifies the chat when the job store throws while handling a free-text reason reply", async () => {
      jobService.findJobAwaitingReasonReply.mockRejectedValue(new Error("8 RESOURCE_EXHAUSTED: Quota exceeded."));
      const provider = makeProvider();

      await handleTelegramUpdate(replyUpdate("some reason", 321), provider);

      expect(provider.sendMessage).toHaveBeenCalledWith(String(CHAT_ID), expect.stringContaining("try again"));
    });
  });
});

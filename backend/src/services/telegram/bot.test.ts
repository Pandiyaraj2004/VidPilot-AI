import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    statusText: ok ? "OK" : "Bad Request",
    json: async () => body,
  } as Response;
}

describe("TelegramBotProvider", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    process.env.TELEGRAM_BOT_TOKEN = "test-token";
    process.env.TELEGRAM_CHAT_ID = "12345";
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...ORIGINAL_ENV };
  });

  async function loadProvider() {
    const { TelegramBotProvider } = await import("./bot.js");
    return new TelegramBotProvider();
  }

  it("reports not configured when the token or chat id is missing", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "";
    const provider = await loadProvider();
    expect(provider.isConfigured()).toBe(false);
  });

  it("reports configured when both are set", async () => {
    const provider = await loadProvider();
    expect(provider.isConfigured()).toBe(true);
  });

  it("sendMessage posts to the real Telegram sendMessage endpoint and returns the message id", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, result: { message_id: 42 } }));
    const provider = await loadProvider();

    const result = await provider.sendMessage("12345", "hello");

    expect(result).toEqual({ messageId: 42 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.telegram.org/bottest-token/sendMessage");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toEqual({ chat_id: "12345", text: "hello" });
  });

  it("sendMessage includes an inline keyboard when buttons are given", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, result: { message_id: 1 } }));
    const provider = await loadProvider();

    await provider.sendMessage("12345", "hello", { buttons: [[{ text: "OK", callback_data: "a:1:1" }]] });

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.reply_markup).toEqual({ inline_keyboard: [[{ text: "OK", callback_data: "a:1:1" }]] });
  });

  it("sendMessage sets force_reply when forceReply is requested", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, result: { message_id: 1 } }));
    const provider = await loadProvider();

    await provider.sendMessage("12345", "why?", { forceReply: true });

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.reply_markup).toEqual({ force_reply: true });
  });

  it("throws TelegramApiError with Telegram's real description on an API-level failure", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: false, description: "Bad Request: chat not found" }, false, 400));
    const { TelegramApiError } = await import("./bot.js");
    const provider = await loadProvider();

    await expect(provider.sendMessage("12345", "hello")).rejects.toThrow(TelegramApiError);
    await expect(provider.sendMessage("12345", "hello")).rejects.toThrow(/chat not found/);
  });

  it("throws when neither the token nor chat id is configured, without calling fetch", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "";
    process.env.TELEGRAM_CHAT_ID = "";
    const provider = await loadProvider();

    await expect(provider.sendMessage("12345", "hello")).rejects.toThrow(/not configured/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("editMessageReplyMarkup sends an empty inline_keyboard when buttons is null", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, result: true }));
    const provider = await loadProvider();

    await provider.editMessageReplyMarkup("12345", 7, null);

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toEqual({ chat_id: "12345", message_id: 7, reply_markup: { inline_keyboard: [] } });
  });

  it("answerCallbackQuery omits text when none is given", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, result: true }));
    const provider = await loadProvider();

    await provider.answerCallbackQuery("cbq-1");

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toEqual({ callback_query_id: "cbq-1" });
  });

  it("getUpdates passes offset/timeout/allowed_updates and returns the real updates array", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, result: [{ update_id: 5 }] }));
    const provider = await loadProvider();

    const updates = await provider.getUpdates(5, 30);

    expect(updates).toEqual([{ update_id: 5 }]);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toEqual({ offset: 5, timeout: 30, allowed_updates: ["message", "callback_query"] });
  });

  it("getUpdates returns an empty array rather than throwing when Telegram sends no result", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    const provider = await loadProvider();

    expect(await provider.getUpdates(0, 30)).toEqual([]);
  });
});

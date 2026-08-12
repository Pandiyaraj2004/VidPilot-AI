/**
 * Compact `callback_data` encode/decode (Phase 10). Telegram caps
 * `callback_data` at 64 bytes, so this can't just be a JSON blob with a
 * job id — it's a short delimited string instead. Pure and side-effect
 * free so the encoding/parsing logic is testable without a real Telegram
 * call or a real job.
 */

import type { InlineKeyboardButton } from "./telegramProvider.js";

export type QuickReasonCode = "captions" | "voice" | "visuals" | "music" | "timing" | "script" | "other";

export const QUICK_REASON_LABELS: Record<QuickReasonCode, string> = {
  captions: "Captions",
  voice: "Voice",
  visuals: "Visuals",
  music: "Music/SFX",
  timing: "Timing",
  script: "Script",
  other: "Other",
};

const QUICK_REASON_CODES: QuickReasonCode[] = ["captions", "voice", "visuals", "music", "timing", "script", "other"];

export type ParsedCallbackData =
  | { type: "approve"; jobId: string; version: number }
  | { type: "reject"; jobId: string; version: number }
  | { type: "reject_reason"; jobId: string; version: number; reasonCode: QuickReasonCode };

const MAX_CALLBACK_DATA_BYTES = 64;

function assertFits(data: string): string {
  if (Buffer.byteLength(data, "utf8") > MAX_CALLBACK_DATA_BYTES) {
    throw new Error(`callback_data exceeds Telegram's ${MAX_CALLBACK_DATA_BYTES}-byte limit: "${data}" (${Buffer.byteLength(data, "utf8")} bytes).`);
  }
  return data;
}

export function encodeApprove(jobId: string, version: number): string {
  return assertFits(`a:${jobId}:${version}`);
}

export function encodeReject(jobId: string, version: number): string {
  return assertFits(`r:${jobId}:${version}`);
}

export function encodeQuickReason(jobId: string, version: number, reasonCode: QuickReasonCode): string {
  return assertFits(`rr:${jobId}:${version}:${reasonCode}`);
}

/** Returns null for anything malformed/unrecognized rather than throwing — a webhook/poll handler should treat an unparseable payload as "ignore," never crash the update loop. */
export function parseCallbackData(data: string | undefined): ParsedCallbackData | null {
  if (!data) return null;
  const parts = data.split(":");

  if (parts[0] === "a" && parts.length === 3) {
    const version = Number(parts[2]);
    if (!parts[1] || !Number.isFinite(version)) return null;
    return { type: "approve", jobId: parts[1], version };
  }

  if (parts[0] === "r" && parts.length === 3) {
    const version = Number(parts[2]);
    if (!parts[1] || !Number.isFinite(version)) return null;
    return { type: "reject", jobId: parts[1], version };
  }

  if (parts[0] === "rr" && parts.length === 4) {
    const version = Number(parts[2]);
    const reasonCode = parts[3] as QuickReasonCode;
    if (!parts[1] || !Number.isFinite(version) || !QUICK_REASON_CODES.includes(reasonCode)) return null;
    return { type: "reject_reason", jobId: parts[1], version, reasonCode };
  }

  return null;
}

/** The initial Approve/Reject row sent with the video itself. */
export function buildApprovalButtons(jobId: string, version: number): InlineKeyboardButton[][] {
  return [
    [
      { text: "✅ APPROVE", callback_data: encodeApprove(jobId, version) },
      { text: "❌ REJECT", callback_data: encodeReject(jobId, version) },
    ],
  ];
}

/** Shown after a Reject tap alongside the free-text reason prompt — two per row so the keyboard stays compact on a phone screen. */
export function buildQuickReasonButtons(jobId: string, version: number): InlineKeyboardButton[][] {
  const rows: InlineKeyboardButton[][] = [];
  for (let i = 0; i < QUICK_REASON_CODES.length; i += 2) {
    rows.push(
      QUICK_REASON_CODES.slice(i, i + 2).map((code) => ({
        text: QUICK_REASON_LABELS[code],
        callback_data: encodeQuickReason(jobId, version, code),
      }))
    );
  }
  return rows;
}

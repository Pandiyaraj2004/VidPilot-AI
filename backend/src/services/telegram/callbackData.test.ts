import { describe, expect, it } from "vitest";
import {
  buildApprovalButtons,
  buildQuickReasonButtons,
  encodeApprove,
  encodeQuickReason,
  encodeReject,
  parseCallbackData,
} from "./callbackData.js";

describe("encode/parse round trip", () => {
  it("round-trips an approve action", () => {
    const data = encodeApprove("job-123", 1);
    expect(parseCallbackData(data)).toEqual({ type: "approve", jobId: "job-123", version: 1 });
  });

  it("round-trips a reject action", () => {
    const data = encodeReject("job-123", 3);
    expect(parseCallbackData(data)).toEqual({ type: "reject", jobId: "job-123", version: 3 });
  });

  it("round-trips a quick-reason action", () => {
    const data = encodeQuickReason("job-123", 2, "captions");
    expect(parseCallbackData(data)).toEqual({ type: "reject_reason", jobId: "job-123", version: 2, reasonCode: "captions" });
  });
});

describe("parseCallbackData — malformed input never throws", () => {
  it("returns null for undefined", () => {
    expect(parseCallbackData(undefined)).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(parseCallbackData("")).toBeNull();
  });

  it("returns null for an unknown prefix", () => {
    expect(parseCallbackData("x:job-123:1")).toBeNull();
  });

  it("returns null for a non-numeric version", () => {
    expect(parseCallbackData("a:job-123:not-a-number")).toBeNull();
  });

  it("returns null for a missing job id", () => {
    expect(parseCallbackData("a::1")).toBeNull();
  });

  it("returns null for an unknown quick-reason code", () => {
    expect(parseCallbackData("rr:job-123:1:not-a-real-reason")).toBeNull();
  });

  it("returns null for a wrong part count", () => {
    expect(parseCallbackData("a:job-123")).toBeNull();
    expect(parseCallbackData("a:job-123:1:extra")).toBeNull();
  });

  it("returns null for a job id containing a colon (would misparse the parts)", () => {
    // documents the encoding's real limitation rather than silently mishandling it
    expect(parseCallbackData("a:job:with:colons:1")).toBeNull();
  });
});

describe("64-byte callback_data limit", () => {
  it("throws when a job id would push an encoded action over Telegram's real limit", () => {
    const longJobId = "x".repeat(62);
    expect(() => encodeApprove(longJobId, 1)).toThrow(/64-byte limit/);
  });

  it("fits a realistic Firestore-style job id comfortably under the limit", () => {
    // Firestore auto-ids are 20 chars — real job ids in this app are well within budget.
    const realisticJobId = "8lpECQ5FEqnbObo3wM0K";
    expect(() => encodeApprove(realisticJobId, 999)).not.toThrow();
    expect(() => encodeQuickReason(realisticJobId, 999, "other")).not.toThrow();
  });
});

describe("button builders", () => {
  it("builds a single Approve/Reject row with correctly encoded callback_data", () => {
    const buttons = buildApprovalButtons("job-1", 1);
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveLength(2);
    expect(parseCallbackData(buttons[0][0].callback_data)).toEqual({ type: "approve", jobId: "job-1", version: 1 });
    expect(parseCallbackData(buttons[0][1].callback_data)).toEqual({ type: "reject", jobId: "job-1", version: 1 });
  });

  it("builds all 7 quick-reason codes, two per row", () => {
    const buttons = buildQuickReasonButtons("job-1", 1);
    const flat = buttons.flat();
    expect(flat).toHaveLength(7);
    expect(buttons[buttons.length - 1]).toHaveLength(1); // odd count -> last row has 1
    for (const button of flat) {
      const parsed = parseCallbackData(button.callback_data);
      expect(parsed?.type).toBe("reject_reason");
    }
  });
});

import { describe, it, expect } from "vitest";
import { computeWordTimings } from "./wordTiming";

describe("computeWordTimings", () => {
  it("returns one entry per word, in order, for a simple English sentence", () => {
    const result = computeWordTimings("Only 1% of the ocean has been explored.", 10, 14);
    expect(result.map((w) => w.word)).toEqual(["Only", "1%", "of", "the", "ocean", "has", "been", "explored."]);
  });

  it("keeps every word's window strictly increasing and non-overlapping", () => {
    const result = computeWordTimings("Never give up on your dreams", 0, 3.6);
    for (let i = 1; i < result.length; i++) {
      expect(result[i].startSeconds).toBeCloseTo(result[i - 1].endSeconds, 6);
      expect(result[i].endSeconds).toBeGreaterThan(result[i].startSeconds);
    }
  });

  it("the first word starts exactly at the cue's real startSeconds", () => {
    const result = computeWordTimings("But here's the secret", 5.2, 8.9);
    expect(result[0].startSeconds).toBe(5.2);
  });

  it("the last word ends exactly at the cue's real endSeconds — never short from rounding drift", () => {
    const result = computeWordTimings("The answer is gravity", 1.111, 4.987);
    expect(result[result.length - 1].endSeconds).toBe(4.987);
  });

  it("gives a longer word a proportionally larger share of the window than a shorter one", () => {
    const result = computeWordTimings("a extraordinarily", 0, 9);
    const [short, long] = result;
    const shortDur = short.endSeconds - short.startSeconds;
    const longDur = long.endSeconds - long.startSeconds;
    expect(longDur).toBeGreaterThan(shortDur);
  });

  it("handles Hindi text (Devanagari combining marks) without splitting mid-word", () => {
    const result = computeWordTimings("योग करने के फायदे क्या हैं", 0, 5);
    expect(result.map((w) => w.word)).toEqual(["योग", "करने", "के", "फायदे", "क्या", "हैं"]);
    expect(result[result.length - 1].endSeconds).toBe(5);
  });

  it("handles Tamil text without splitting mid-cluster", () => {
    const result = computeWordTimings("இது ஒரு சோதனை வாக்கியம்", 0, 4);
    expect(result.map((w) => w.word)).toEqual(["இது", "ஒரு", "சோதனை", "வாக்கியம்"]);
    expect(result[result.length - 1].endSeconds).toBe(4);
  });

  it("handles a single-word cue — the one word spans the entire window", () => {
    const result = computeWordTimings("Explored.", 2, 3.5);
    expect(result).toEqual([{ word: "Explored.", startSeconds: 2, endSeconds: 3.5 }]);
  });

  it("returns an empty array for empty/whitespace-only text", () => {
    expect(computeWordTimings("", 0, 5)).toEqual([]);
    expect(computeWordTimings("   ", 0, 5)).toEqual([]);
  });

  it("returns an empty array when the window has zero or negative duration", () => {
    expect(computeWordTimings("hello world", 5, 5)).toEqual([]);
    expect(computeWordTimings("hello world", 5, 4)).toEqual([]);
  });

  it("collapses multiple internal spaces without producing empty word entries", () => {
    const result = computeWordTimings("hello    world", 0, 2);
    expect(result.map((w) => w.word)).toEqual(["hello", "world"]);
  });
});

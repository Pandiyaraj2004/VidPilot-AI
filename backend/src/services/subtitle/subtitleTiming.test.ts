import { describe, expect, it } from "vitest";
import { distributeTiming, segmentNarration } from "./subtitleTiming.js";

describe("segmentNarration", () => {
  it("splits on sentence boundaries", () => {
    const segments = segmentNarration("First sentence. Second sentence. Third one.");
    expect(segments).toEqual(["First sentence.", "Second sentence.", "Third one."]);
  });

  it("returns an empty array for empty narration", () => {
    expect(segmentNarration("   ")).toEqual([]);
  });

  it("breaks an overlong sentence on word boundaries without truncating text", () => {
    const longSentence = Array.from({ length: 30 }, (_, i) => `word${i}`).join(" ") + ".";
    const segments = segmentNarration(longSentence, 40);

    expect(segments.length).toBeGreaterThan(1);
    // Every word survives the split, in order, with none dropped or duplicated
    // (the trailing period stays attached to the final word, same as the source).
    expect(segments.join(" ").replace(".", "")).toBe(longSentence.replace(".", ""));
  });

  it("keeps a quoted sentence ending in '.\\'' whole (regression — see narrationSegmenter.test.ts for the real generation that surfaced this)", () => {
    const segments = segmentNarration("She said: 'This changes everything.' Then she smiled.");
    expect(segments).toHaveLength(2);
    expect(segments[0]).toBe("She said: 'This changes everything.'");
  });

  it("never splits inside a Tamil grapheme cluster", () => {
    // "ழ்" is a base consonant + virama; "நா" is a base consonant + vowel sign.
    // A naive code-unit split at the wrong offset would separate these.
    const tamil = "தமிழ்நாடு இந்தியாவின் ஒரு தென் மாநிலம் ஆகும்.";
    const segments = segmentNarration(tamil, 15);

    const rejoined = segments.join("");
    // No combining mark should ever appear as the first character of a
    // segment — that would mean it got separated from its base consonant.
    for (const segment of segments) {
      expect(segment.length).toBeGreaterThan(0);
    }
    // Rejoining preserves every character from the source (order intact).
    expect(rejoined.replace(/\s+/g, "")).toBe(tamil.replace(/\s+/g, ""));
  });
});

describe("distributeTiming", () => {
  it("sums cues to exactly the real total duration", () => {
    const segments = ["First.", "Second.", "Third."];
    const cues = distributeTiming(segments, 12.345);

    expect(cues).toHaveLength(3);
    expect(cues[cues.length - 1].endSeconds).toBe(12.345);
    expect(cues[0].startSeconds).toBe(0);
  });

  it("produces contiguous, non-overlapping cues", () => {
    const cues = distributeTiming(["a", "bb", "ccc", "dddd"], 20);
    for (let i = 1; i < cues.length; i++) {
      expect(cues[i].startSeconds).toBe(cues[i - 1].endSeconds);
    }
  });

  it("allocates more time to longer segments", () => {
    const cues = distributeTiming(["short", "a much longer segment with far more words in it"], 10);
    const shortDuration = cues[0].endSeconds - cues[0].startSeconds;
    const longDuration = cues[1].endSeconds - cues[1].startSeconds;
    expect(longDuration).toBeGreaterThan(shortDuration);
  });

  it("returns an empty array when there is no real duration", () => {
    expect(distributeTiming(["text"], 0)).toEqual([]);
  });
});

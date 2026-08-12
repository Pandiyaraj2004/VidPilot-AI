import { describe, it, expect } from "vitest";
import { segmentNarrationForSynthesis, splitIntoSentences } from "./narrationSegmenter.js";

describe("splitIntoSentences", () => {
  it("splits multiple sentences on their terminating punctuation", () => {
    const result = splitIntoSentences("The brain is powerful. It uses lots of energy! Did you know that?");
    expect(result).toHaveLength(3);
    expect(result[0]).toBe("The brain is powerful.");
    expect(result[2]).toBe("Did you know that?");
  });

  it("returns the whole string as one sentence when there is no terminating punctuation", () => {
    const result = splitIntoSentences("just one long clause with no punctuation at all");
    expect(result).toHaveLength(1);
  });

  it("returns an empty array for empty/whitespace-only input", () => {
    expect(splitIntoSentences("")).toEqual([]);
    expect(splitIntoSentences("   ")).toEqual([]);
  });

  it("keeps a quoted sentence ending in '.'\" whole, instead of degenerating into a trailing punctuation-only fragment", () => {
    // Regression: found via a real generation where this exact narration
    // caused Piper to receive a lone "'" as its own "sentence," producing
    // a WAV with no audio data and failing the whole scene.
    const result = splitIntoSentences(
      "But deep down, a resilience burns. That quiet voice telling you: 'You are stronger than you think.'"
    );
    expect(result).toHaveLength(2);
    expect(result[1]).toBe("That quiet voice telling you: 'You are stronger than you think.'");
    expect(result.every((s) => s.replace(/[^a-zA-Z]/g, "").length > 0)).toBe(true);
  });

  it("handles a sentence ending in a double-quote after the terminator", () => {
    const result = splitIntoSentences('She said, "This changes everything." Then she smiled.');
    expect(result).toHaveLength(2);
    expect(result[0]).toBe('She said, "This changes everything."');
  });

  it("splits real Tamil sentences correctly (ASCII terminators, combining marks unaffected)", () => {
    const result = splitIntoSentences("இது ஒரு வாக்கியம். இது இரண்டாவது வாக்கியம்.");
    expect(result).toHaveLength(2);
    expect(result[0]).toContain("வாக்கியம்");
  });

  it("splits real Hindi/Devanagari sentences correctly", () => {
    const result = splitIntoSentences("यह एक वाक्य है। यह दूसरा वाक्य है।");
    expect(result).toHaveLength(2);
  });
});

describe("segmentNarrationForSynthesis", () => {
  it("marks the first and last sentence correctly for a multi-sentence scene", () => {
    const result = segmentNarrationForSynthesis("First sentence. Second sentence. Third sentence.");
    expect(result).toHaveLength(3);
    expect(result[0].isFirst).toBe(true);
    expect(result[0].isLast).toBe(false);
    expect(result[2].isLast).toBe(true);
    expect(result[2].isFirst).toBe(false);
  });

  it("marks a single sentence as both first and last", () => {
    const result = segmentNarrationForSynthesis("Only one sentence here.");
    expect(result).toHaveLength(1);
    expect(result[0].isFirst).toBe(true);
    expect(result[0].isLast).toBe(true);
  });

  it("returns an empty array for empty narration", () => {
    expect(segmentNarrationForSynthesis("")).toEqual([]);
  });
});

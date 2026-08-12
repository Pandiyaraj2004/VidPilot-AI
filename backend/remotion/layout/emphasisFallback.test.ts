import { describe, it, expect } from "vitest";
import { selectFallbackHighlightWords } from "./emphasisFallback";

describe("selectFallbackHighlightWords", () => {
  it("prefers a digit-containing word over a longer plain word", () => {
    const result = selectFallbackHighlightWords(["Only 1% of the ocean has been extraordinarily explored."]);
    expect(result).toEqual(["1%"]);
  });

  it("falls back to the longest word (>= 5 graphemes) when no digit is present", () => {
    const result = selectFallbackHighlightWords(["Never give up on your dreams"]);
    expect(result).toEqual(["dreams"]);
  });

  it("returns an empty array when every word is shorter than the minimum", () => {
    const result = selectFallbackHighlightWords(["I am ok now"]);
    expect(result).toEqual([]);
  });

  it("returns at most one word even across multiple cues", () => {
    const result = selectFallbackHighlightWords(["This is amazing and wonderful.", "Absolutely incredible stuff happens."]);
    expect(result.length).toBeLessThanOrEqual(1);
  });

  it("ignores surrounding punctuation when measuring word length but returns the original token", () => {
    const result = selectFallbackHighlightWords(["That deep well of strength and resilience?"]);
    expect(result).toEqual(["resilience?"]);
  });

  it("works for Hindi text — picks a digit token when present", () => {
    const result = selectFallbackHighlightWords(["योग करने के 10 बड़े फायदे हैं"]);
    expect(result).toEqual(["10"]);
  });

  it("works for Hindi text — falls back to the longest word when no digit is present", () => {
    const result = selectFallbackHighlightWords(["स्वतंत्रता संग्राम में अनेक वीरों ने बलिदान दिया"]);
    expect(result.length).toBe(1);
  });

  it("works for Tamil text", () => {
    const result = selectFallbackHighlightWords(["இது ஒரு சுவாரஸ்யமான தகவல் ஆகும்"]);
    expect(result.length).toBe(1);
  });

  it("returns an empty array for empty input", () => {
    expect(selectFallbackHighlightWords([])).toEqual([]);
    expect(selectFallbackHighlightWords([""])).toEqual([]);
  });
});

/**
 * Deterministic emphasis-word fallback — only used when a scene's
 * AI-provided `highlightWords` (backend/src/services/ai/schema.ts) is
 * empty or absent. Never pretends to be AI-chosen: it's a conservative,
 * at-most-one-word pick so a scene with no AI emphasis still gets a
 * caption pop rather than none at all, without overreaching into
 * guessing "important" content the way the AI's own judgment would.
 *
 * Preference order: a token containing a digit (statistics/numbers are
 * natural emphasis material — the "Only 1%" example is exactly this
 * case), else the longest alphabetic-ish token of at least 5 graphemes.
 * Works across scripts (English/Hindi/Tamil) via a Unicode-aware letter
 * test rather than an ASCII-only regex.
 */

function graphemeLength(text: string): number {
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  return Array.from(segmenter.segment(text)).length;
}

function lettersOnly(word: string): string {
  return word.replace(/[^\p{L}\p{N}]/gu, "");
}

const MIN_FALLBACK_WORD_GRAPHEMES = 5;

/** `cueTexts` is every subtitle cue's text for one scene — the fallback looks at the whole scene's narration, matching the AI field it's standing in for (highlightWords is scene-level, not per-cue). */
export function selectFallbackHighlightWords(cueTexts: string[]): string[] {
  const words = cueTexts.flatMap((t) => t.split(/\s+/)).filter(Boolean);

  const digitWord = words.find((w) => /\d/.test(w));
  if (digitWord) return [digitWord];

  let best: string | null = null;
  let bestLength = 0;
  for (const word of words) {
    const length = graphemeLength(lettersOnly(word));
    if (length >= MIN_FALLBACK_WORD_GRAPHEMES && length > bestLength) {
      best = word;
      bestLength = length;
    }
  }
  return best ? [best] : [];
}

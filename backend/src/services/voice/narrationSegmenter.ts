/**
 * Splits a scene's narration into sentence-level chunks for the Phase 6
 * per-sentence synthesis pipeline (see voiceEngine.ts) — a different job
 * from subtitle/subtitleTiming.ts's segmentNarration, which chunks by
 * character width for on-screen readability. This only needs real sentence
 * boundaries, so it doesn't need subtitleTiming's grapheme-cluster/max-chars
 * machinery — ".", "!", "?" are themselves separate codepoints from
 * whatever grapheme cluster precedes them in Tamil/Devanagari text, so a
 * plain boundary split never lands inside a combining-character sequence.
 */

export interface NarrationSentence {
  text: string;
  isFirst: boolean;
  isLast: boolean;
}

// Hindi/Devanagari sentences end in "।" (danda) or "॥" (double danda), not a
// period — a plain ASCII-only terminator set would silently never split
// real Hindi narration into more than one sentence.
//
// A sentence terminator is often followed by a closing quote/bracket
// ('..."', "...'", "...)") before the actual sentence boundary — found via
// a real generation where "...you think.'" produced a degenerate trailing
// fragment (a lone "'") because the terminator group didn't absorb the
// closing quote, so the whitespace-or-end assertion never matched right
// after the period. The trailing character class below absorbs those.
const SENTENCE_REGEX = /[^.!?।॥]+[.!?।॥]*["'‘’“”)\]]*(\s+|$)/g;

export function splitIntoSentences(narration: string): string[] {
  const trimmed = narration.trim();
  if (!trimmed) return [];

  const matches = trimmed.match(SENTENCE_REGEX);
  const sentences = (matches ?? [trimmed]).map((s) => s.trim()).filter(Boolean);
  return sentences.length > 0 ? sentences : [trimmed];
}

/** Sentence-level chunks annotated with position, for pause placement (see voiceDirectionSystem.ts's StructuralPause). */
export function segmentNarrationForSynthesis(narration: string): NarrationSentence[] {
  const sentences = splitIntoSentences(narration);
  return sentences.map((text, i) => ({
    text,
    isFirst: i === 0,
    isLast: i === sentences.length - 1,
  }));
}

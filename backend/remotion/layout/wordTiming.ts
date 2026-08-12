/**
 * Word-level reveal timing — a deterministic approximation, not real
 * forced-alignment/ASR timing (no provider in this pipeline exposes that).
 * Distributes a subtitle cue's already-real `[startSeconds, endSeconds]`
 * window (itself derived from the scene's real measured audio duration —
 * see subtitleTiming.ts's distributeTiming) proportionally across the
 * cue's words, weighted by grapheme-cluster length. Same weighting
 * technique subtitleTiming.ts already uses at the cue level, just applied
 * one level down to words — reused on purpose, not reinvented.
 *
 * Pure and DOM-free (Intl.Segmenter only) so this is testable with plain
 * Vitest, unlike subtitleLayout.ts which genuinely needs a real canvas.
 */

export interface WordTiming {
  word: string;
  startSeconds: number;
  endSeconds: number;
}

function graphemeClusters(text: string): string[] {
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  return Array.from(segmenter.segment(text), (s) => s.segment);
}

/**
 * Splits `text` on whitespace (same tokenization `wrapTextToLines` and
 * `HighlightedLine` already use) and assigns each word a slice of
 * `[startSeconds, endSeconds]` proportional to its grapheme-cluster count.
 * The last word's `endSeconds` is always pinned to the real `endSeconds`
 * input (never left short by floating-point drift), same rescale-to-exact
 * pattern `distributeTiming` uses.
 */
export function computeWordTimings(text: string, startSeconds: number, endSeconds: number): WordTiming[] {
  const words = text.split(/\s+/).filter(Boolean);
  const duration = Math.max(0, endSeconds - startSeconds);
  if (words.length === 0 || duration <= 0) return [];

  const weights = words.map((w) => Math.max(graphemeClusters(w).length, 1));
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  const timings: WordTiming[] = [];
  let cursor = startSeconds;
  for (let i = 0; i < words.length; i++) {
    const isLast = i === words.length - 1;
    const wordEnd = isLast ? endSeconds : cursor + (weights[i] / totalWeight) * duration;
    timings.push({ word: words[i], startSeconds: cursor, endSeconds: wordEnd });
    cursor = wordEnd;
  }
  return timings;
}

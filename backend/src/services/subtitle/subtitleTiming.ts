export interface TimedSegment {
  text: string;
  startSeconds: number;
  endSeconds: number;
}

// ~2 lines at ~45 characters/line — a common subtitle-readability guideline.
const MAX_CHARS_PER_CUE = 90;
const MIN_CUE_SECONDS = 0.8;

/**
 * Counts by grapheme cluster, not UTF-16 code unit or byte — Tamil and
 * Devanagari routinely render one visible "character" as a base consonant
 * plus one or more combining vowel/virama code points. Splitting text at a
 * raw string index can land inside such a cluster and produce a broken or
 * missing glyph; Intl.Segmenter's grapheme boundaries never do.
 */
function graphemeClusters(text: string): string[] {
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  return Array.from(segmenter.segment(text), (s) => s.segment);
}

// Same terminator set (incl. Devanagari danda) and closing-quote handling as
// voice/narrationSegmenter.ts's splitIntoSentences — found via a real
// generation where "...you think.'" produced a degenerate trailing
// fragment (a lone "'") because the terminator group didn't absorb the
// closing quote before the whitespace-or-end assertion.
function splitIntoSentences(text: string): string[] {
  const matches = text.match(/[^.!?।॥]+[.!?।॥]*["'‘’“”)\]]*(\s+|$)/g);
  return (matches ?? [text]).map((s) => s.trim()).filter(Boolean);
}

/** Breaks an overlong sentence on whitespace so a cue never exceeds maxChars, without ever cutting inside a word or a grapheme cluster. */
function splitLongSegment(segment: string, maxChars: number): string[] {
  if (graphemeClusters(segment).length <= maxChars) return [segment];

  const words = segment.split(/(\s+)/).filter((w) => w.length > 0);
  const chunks: string[] = [];
  let current = "";
  let currentLen = 0;

  for (const word of words) {
    const wordLen = graphemeClusters(word).length;
    if (currentLen + wordLen > maxChars && current.trim()) {
      chunks.push(current.trim());
      current = "";
      currentLen = 0;
    }
    current += word;
    currentLen += wordLen;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length > 0 ? chunks : [segment];
}

/** Splits narration into readable cues. Pure text segmentation — carries no timing; see distributeTiming. */
export function segmentNarration(narration: string, maxCharsPerCue: number = MAX_CHARS_PER_CUE): string[] {
  const trimmed = narration.trim();
  if (!trimmed) return [];

  const sentences = splitIntoSentences(trimmed);
  const segments: string[] = [];
  for (const sentence of sentences) {
    segments.push(...splitLongSegment(sentence, maxCharsPerCue));
  }
  return segments.length > 0 ? segments : [trimmed];
}

/**
 * Allocates the scene's real, measured audio duration across cues,
 * proportional to each cue's grapheme-cluster length — the closest proxy
 * to spoken duration available without word-level forced alignment (which
 * neither Piper nor Edge TTS expose here). Cues are then rescaled so they
 * always sum to exactly `totalDurationSeconds`: the real value, never an
 * estimate. The per-cue minimum floor is best-effort — in a scene with many
 * very short cues and little total duration, rescaling can compress a cue
 * below the floor; there is no ambiguity in the total, only in how it is
 * divided.
 */
export function distributeTiming(
  segments: string[],
  totalDurationSeconds: number,
  minCueSeconds: number = MIN_CUE_SECONDS
): TimedSegment[] {
  if (segments.length === 0 || totalDurationSeconds <= 0) return [];

  const weights = segments.map((s) => Math.max(graphemeClusters(s).length, 1));
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  const raw = weights.map((w) => Math.max((w / totalWeight) * totalDurationSeconds, minCueSeconds));
  const rawTotal = raw.reduce((a, b) => a + b, 0);
  const scale = totalDurationSeconds / rawTotal;

  const cues: TimedSegment[] = [];
  let cursor = 0;
  for (let i = 0; i < segments.length; i++) {
    const isLast = i === segments.length - 1;
    const endSeconds = isLast ? totalDurationSeconds : cursor + raw[i] * scale;
    cues.push({ text: segments[i], startSeconds: cursor, endSeconds });
    cursor = endSeconds;
  }
  return cues;
}

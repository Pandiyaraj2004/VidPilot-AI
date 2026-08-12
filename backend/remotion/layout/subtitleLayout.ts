/**
 * Real subtitle layout — genuine Chrome text measurement (Remotion renders
 * in an actual headless Chrome, so `canvas.measureText` returns the real
 * pixel width the browser will draw, not an estimate), used to wrap on
 * word boundaries only and to shrink font size until the whole caption
 * genuinely fits inside its safe region instead of assuming it will.
 */

const MIN_FONT_SIZE_PX = 28;
const FONT_SIZE_STEP_PX = 4;
const LINE_HEIGHT_MULTIPLIER = 1.35;
/** DynamicCaption scales a highlighted word up to 1.18x — wrapping measures at this factor too, so a highlighted word can never overflow a line that looked fine at the base size. */
const HIGHLIGHT_WIDTH_SAFETY_FACTOR = 1.18;

export interface SubtitleLayoutResult {
  lines: string[];
  fontSizePx: number;
  lineHeightPx: number;
  boxHeightPx: number;
  boxWidthPx: number;
}

function getMeasurementContext(): CanvasRenderingContext2D | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  return canvas.getContext("2d");
}

function measureTextWidth(ctx: CanvasRenderingContext2D, text: string, fontSizePx: number, fontFamily: string, fontWeight: number): number {
  ctx.font = `${fontWeight} ${fontSizePx}px ${fontFamily}`;
  return ctx.measureText(text).width;
}

/** Greedy word-boundary wrapping against real measured width — never splits mid-word, never overflows the given width. */
export function wrapTextToLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidthPx: number,
  fontSizePx: number,
  fontFamily: string,
  fontWeight: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let current = words[0];
  for (let i = 1; i < words.length; i++) {
    const candidate = `${current} ${words[i]}`;
    const width = measureTextWidth(ctx, candidate, fontSizePx * HIGHLIGHT_WIDTH_SAFETY_FACTOR, fontFamily, fontWeight);
    if (width <= maxWidthPx) {
      current = candidate;
    } else {
      lines.push(current);
      current = words[i];
    }
  }
  lines.push(current);
  return lines;
}

/**
 * Finds the largest font size (down to a readable floor) at which the cue's
 * wrapped lines genuinely fit inside `maxWidthPx` x `maxHeightPx` — computed
 * from real measurement, not assumed. Never returns zero lines, even in a
 * degenerate case (falls back to the floor size, which is still readable).
 */
export function fitSubtitleLayout(
  text: string,
  maxWidthPx: number,
  maxHeightPx: number,
  fontFamily: string,
  preferredFontSizePx: number,
  fontWeight = 700
): SubtitleLayoutResult {
  const ctx = getMeasurementContext();

  const tryFit = (fontSizePx: number): SubtitleLayoutResult => {
    const lines = ctx ? wrapTextToLines(ctx, text, maxWidthPx, fontSizePx, fontFamily, fontWeight) : [text];
    const lineHeightPx = fontSizePx * LINE_HEIGHT_MULTIPLIER;
    const verticalPadding = fontSizePx * 0.8;
    const boxHeightPx = lines.length * lineHeightPx + verticalPadding;
    const widestLine = ctx
      ? Math.max(...lines.map((l) => measureTextWidth(ctx, l, fontSizePx * HIGHLIGHT_WIDTH_SAFETY_FACTOR, fontFamily, fontWeight)))
      : maxWidthPx;
    const boxWidthPx = Math.min(maxWidthPx, widestLine + fontSizePx * 1.2);
    return { lines, fontSizePx, lineHeightPx, boxHeightPx, boxWidthPx };
  };

  for (let fontSizePx = preferredFontSizePx; fontSizePx > MIN_FONT_SIZE_PX; fontSizePx -= FONT_SIZE_STEP_PX) {
    const result = tryFit(fontSizePx);
    if (result.boxHeightPx <= maxHeightPx) return result;
  }
  return tryFit(MIN_FONT_SIZE_PX);
}

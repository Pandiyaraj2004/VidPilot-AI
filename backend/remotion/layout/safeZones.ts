/**
 * The single source of truth for where text is allowed to sit on screen.
 * Every fraction is relative to the real composition width/height
 * (useVideoConfig()), never a fixed pixel value — this is what makes the
 * layout genuinely portrait/landscape-agnostic instead of "resized."
 *
 * Bands, top to bottom:
 *   TOP_SAFE            — nothing placed above this
 *   TITLE_REGION        — hook/title text lives here only
 *   (visual footage fills the whole frame behind everything)
 *   SUBTITLE_MAX_REGION — narration captions grow upward from the bottom
 *                         margin, capped at this height
 *   BOTTOM_PLATFORM_MARGIN — reserved for the host platform's own UI
 *                            (Shorts like/comment/progress bar); nothing
 *                            is ever placed here
 */

export const TOP_SAFE_FRACTION = 0.06;
export const TITLE_REGION_TOP_FRACTION = 0.08;
export const TITLE_REGION_BOTTOM_FRACTION = 0.34;
export const BOTTOM_PLATFORM_MARGIN_FRACTION = 0.12;
export const SUBTITLE_MAX_REGION_FRACTION = 0.25;
export const HORIZONTAL_MARGIN_FRACTION = 0.06;

export interface Band {
  /** Pixels from the top of the frame. */
  top: number;
  /** Pixels from the top of the frame. */
  bottom: number;
  height: number;
}

export function getTitleBand(height: number): Band {
  const top = height * TITLE_REGION_TOP_FRACTION;
  const bottom = height * TITLE_REGION_BOTTOM_FRACTION;
  return { top, bottom, height: bottom - top };
}

/** The Y coordinate (from the top) below which nothing may be drawn — the platform's own UI lives below this line. */
export function getSubtitleSafeBottom(height: number): number {
  return height * (1 - BOTTOM_PLATFORM_MARGIN_FRACTION);
}

/** The tallest a subtitle box may ever grow, in pixels — beyond this, callers must shrink font size rather than the box overflowing upward into the visual region. */
export function getSubtitleMaxHeight(height: number): number {
  return height * SUBTITLE_MAX_REGION_FRACTION;
}

/** Usable width for any text block, after the left/right safe margins. */
export function getHorizontalSafeWidth(width: number): number {
  return width * (1 - 2 * HORIZONTAL_MARGIN_FRACTION);
}

export function getHorizontalMarginPx(width: number): number {
  return width * HORIZONTAL_MARGIN_FRACTION;
}

export function getTopSafePx(height: number): number {
  return height * TOP_SAFE_FRACTION;
}

/**
 * Caption style system for the Phase 5 dynamic visual engine.
 *
 * Determines the caption layout variant for each scene based on its
 * narrative role and energy level. The style is stored on SceneVisual and
 * consumed by the Remotion DynamicCaption component.
 */

import type { CaptionStyle } from "../../types/index.js";

/**
 * Maps a scene's role and energy to a caption layout style.
 *
 * Styles:
 *  - "hook"      Large, centred, staggered-entrance text. Only for the opening scene.
 *  - "question"  Italic, slightly different layout to signal interrogation.
 *  - "emphasis"  Larger than normal, higher contrast — for high-energy fact reveals.
 *  - "reveal"    Emphasis variant with a dramatic entrance animation.
 *  - "normal"    Standard subtitle-bar layout (Phase 5 MVP baseline).
 */
export function determineCaptionStyle(
  sceneRole: string | undefined,
  energy: number | undefined
): CaptionStyle {
  const e = typeof energy === "number" ? Math.max(0, Math.min(1, energy)) : 0.5;

  if (sceneRole === "hook") return "hook";
  if (sceneRole === "question") return "question";
  if (sceneRole === "reveal") return "reveal";

  // High-energy fact/build scenes get emphasis styling
  if ((sceneRole === "fact" || sceneRole === "build" || sceneRole === "action") && e >= 0.6) {
    return "emphasis";
  }

  return "normal";
}

/**
 * Returns whether the given caption style uses a centred layout
 * (as opposed to the bottom-bar layout used by "normal" and "emphasis").
 */
export function isCentredCaptionStyle(style: CaptionStyle): boolean {
  return style === "hook";
}

/**
 * Returns the recommended font size multiplier for the given style.
 * The base font size is defined in the Remotion composition.
 */
export function captionSizeMultiplier(style: CaptionStyle): number {
  switch (style) {
    case "hook":      return 1.8;
    case "emphasis":  return 1.25;
    case "reveal":    return 1.35;
    case "question":  return 1.1;
    case "normal":
    default:          return 1.0;
  }
}

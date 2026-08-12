/**
 * Content overlay planner for the Phase 5 dynamic visual engine.
 *
 * Analyses a scene's highlightWords, onScreenText, and sceneRole to decide
 * which visual segment (if any) should carry a content overlay — a statistic
 * card, text card, or quote — and what it should say.
 *
 * Responsibilities:
 *   - Detect numeric statistics in highlightWords ("20%", "7", "100,000", etc.)
 *   - Detect question phrasing for question-role scenes
 *   - Generate concise overlay text from onScreenText for hook scenes
 *   - Assign the overlay to a specific segment index (usually not the first)
 *   - Default to "none" when no meaningful overlay can be constructed
 *
 * Does NOT access any external API. Pure text analysis only.
 */

export interface ContentOverlayPlan {
  segmentIndex: number;
  contentType: "none" | "text_card" | "statistic" | "quote";
  contentValue?: string;
  contentLabel?: string;
}

/** Regex that matches things that look like statistics: "20%", "7", "100,000", "3.5x", "$50B" */
const STAT_PATTERN = /^[\$£€]?[\d,]+(?:\.\d+)?(?:[%xX]|[KMBkm])?$|^\d+(?:\.\d+)?[xX]$/;

function looksLikeStatistic(word: string): boolean {
  return STAT_PATTERN.test(word.replace(/,/g, ""));
}

/**
 * Plans content overlays for a scene's visual segments.
 * Returns plans for each segment index (most will be "none").
 */
export function planContentOverlays(
  totalSegments: number,
  options: {
    sceneRole?: string;
    highlightWords?: string[];
    onScreenText?: string;
  }
): ContentOverlayPlan[] {
  const plans: ContentOverlayPlan[] = Array.from({ length: totalSegments }, (_, i) => ({
    segmentIndex: i,
    contentType: "none" as const,
  }));

  const { sceneRole, highlightWords = [], onScreenText = "" } = options;

  // --- 1. Statistic overlay: find a numeric highlight word ---
  const statWord = highlightWords.find((w) => looksLikeStatistic(w.trim()));
  if (statWord) {
    // Place the statistic on the second segment if available, otherwise the last
    const statSegIdx = Math.min(1, totalSegments - 1);
    // Build a label from onScreenText if we have one
    const label = onScreenText.trim()
      ? onScreenText.trim().toUpperCase().slice(0, 60)
      : undefined;
    plans[statSegIdx] = {
      segmentIndex: statSegIdx,
      contentType: "statistic",
      contentValue: statWord.toUpperCase(),
      contentLabel: label,
    };
    return plans; // one overlay per scene is enough
  }

  // --- 2. Hook overlay: text card on the last segment ---
  if (sceneRole === "hook" && onScreenText.trim()) {
    const hookSegIdx = totalSegments - 1;
    plans[hookSegIdx] = {
      segmentIndex: hookSegIdx,
      contentType: "text_card",
      contentValue: onScreenText.trim().toUpperCase().slice(0, 80),
    };
    return plans;
  }

  // --- 3. Question overlay: quote card on the first segment ---
  if (sceneRole === "question" && onScreenText.trim()) {
    plans[0] = {
      segmentIndex: 0,
      contentType: "quote",
      contentValue: onScreenText.trim().slice(0, 120),
    };
    return plans;
  }

  // --- 4. Reveal overlay: text card on the last segment ---
  if (sceneRole === "reveal" && onScreenText.trim()) {
    const revealSegIdx = totalSegments - 1;
    plans[revealSegIdx] = {
      segmentIndex: revealSegIdx,
      contentType: "text_card",
      contentValue: onScreenText.trim().toUpperCase().slice(0, 80),
    };
    return plans;
  }

  // --- 5. Fact overlay: text card with key highlight words ---
  if (sceneRole === "fact" && highlightWords.length > 0) {
    const factSegIdx = Math.min(1, totalSegments - 1);
    plans[factSegIdx] = {
      segmentIndex: factSegIdx,
      contentType: "text_card",
      contentValue: highlightWords.slice(0, 3).join(" · ").toUpperCase(),
    };
    return plans;
  }

  return plans;
}

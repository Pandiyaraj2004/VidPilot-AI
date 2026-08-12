/**
 * Cross-scene transition selection (Phase 8) — mirrors the table-driven
 * approach services/visual/motionSystem.ts and transitionSystem.ts already
 * use, applied one level up: at scene BOUNDARIES rather than between visual
 * segments within one scene. Distinct from transitionSystem.ts on purpose
 * — that module answers "how does segment N blend in from segment N-1
 * inside this one scene's own visual timeline"; this one answers "how does
 * scene N blend in from scene N-1's final rendered video."
 *
 * Primary signal is the job's contentCategory (stable for the whole job,
 * and the spec's own examples are category-shaped: Motivation -> energetic
 * push/zoom, Mystery -> crossfade/dark fade, GK -> cut/fast push, etc.)
 * with energy/emotion only adjusting transition *duration*, not type —
 * content coherence (the category's own curated candidate list) always
 * wins over energy-driven variety.
 */

import type { ContentCategory } from "../../types/index.js";

export type SceneTransitionType =
  | "cut"
  | "crossfade"
  | "fade"
  | "push_left"
  | "push_right"
  | "push_up"
  | "push_down"
  | "zoom"
  | "zoom_burst";

export interface SceneTransitionPlan {
  type: SceneTransitionType;
  durationSeconds: number;
}

/** One candidate list per category, already ordered for alternation (same convention as motionSystem.ts's hand-authored sequences) — cycled by boundary index, with a lightweight repetition guard layered on top (see planSceneTransition). */
const CATEGORY_CANDIDATES: Partial<Record<ContentCategory, SceneTransitionType[]>> = {
  motivation: ["zoom_burst", "push_left", "zoom", "push_right"],
  mystery: ["crossfade", "fade", "crossfade", "fade"],
  general_knowledge: ["cut", "push_left", "cut", "push_right"],
  facts: ["cut", "push_up", "cut", "push_down"],
  science: ["crossfade", "push_up", "crossfade", "push_down"],
  history: ["fade", "crossfade", "fade", "crossfade"],
  space: ["crossfade", "zoom", "crossfade", "fade"],
  ai: ["cut", "crossfade", "push_left", "crossfade"],
  technology: ["cut", "crossfade", "push_left", "crossfade"],
  business: ["cut", "fade", "cut", "fade"],
  news: ["cut", "fade", "cut", "fade"],
  psychology: ["fade", "crossfade", "fade", "crossfade"],
  story: ["crossfade", "fade", "push_left", "crossfade"],
};

const DEFAULT_CANDIDATES: SceneTransitionType[] = ["cut", "crossfade", "cut", "fade"];

const SLOW_EMOTIONS = new Set(["mystery", "calm", "serious", "dramatic"]);
const FAST_EMOTIONS = new Set(["excitement", "motivation", "humorous"]);

/** Never let a transition consume more than this fraction of the shorter of its two adjacent scenes. */
const MAX_TRANSITION_FRACTION = 0.25;
/** Below this, the blend would be imperceptible anyway — collapses to a clean cut instead of a barely-there fade. */
const MIN_TRANSITION_SECONDS = 0.12;

function baseDurationSeconds(emotion: string | undefined, energy: number | undefined): number {
  const e = typeof energy === "number" ? Math.max(0, Math.min(1, energy)) : 0.5;
  if (emotion && SLOW_EMOTIONS.has(emotion)) return 0.6; // slow/mystery/cinematic band: 0.40-0.80s
  if ((emotion && FAST_EMOTIONS.has(emotion)) || e >= 0.65) return 0.22; // fast/high-energy band: 0.15-0.35s
  if (e >= 0.35) return 0.35; // normal band: 0.25-0.50s
  return 0.5;
}

/**
 * Picks the transition for one scene boundary and its duration, clamped so
 * it can never consume an unreasonable share of either adjacent scene
 * (crucial for short scenes) and never negative.
 *
 * @param boundaryIndex - 0-based index of this scene boundary within the
 *   job (0 = between scene 1 and 2, 1 = between scene 2 and 3, ...) — drives
 *   which candidate in the category's list is the natural pick, the same
 *   alternation-by-index convention motionSystem.ts/transitionSystem.ts use.
 * @param recentTransitions - transition types already used at earlier
 *   boundaries in this same job, most recent last. Only the immediately
 *   previous one is consulted — a lightweight guard, not a long memory.
 */
export function planSceneTransition(
  contentCategory: ContentCategory | undefined,
  emotion: string | undefined,
  energy: number | undefined,
  boundaryIndex: number,
  prevSceneDurationSeconds: number,
  nextSceneDurationSeconds: number,
  recentTransitions: SceneTransitionType[]
): SceneTransitionPlan {
  const candidates = (contentCategory && CATEGORY_CANDIDATES[contentCategory]) ?? DEFAULT_CANDIDATES;
  const startIdx = Math.max(0, boundaryIndex) % candidates.length;
  let type = candidates[startIdx];

  const lastUsed = recentTransitions[recentTransitions.length - 1];
  if (type === lastUsed && candidates.some((c) => c !== lastUsed)) {
    for (let offset = 1; offset < candidates.length; offset++) {
      const candidate = candidates[(startIdx + offset) % candidates.length];
      if (candidate !== lastUsed) {
        type = candidate;
        break;
      }
    }
  }

  if (type === "cut") {
    return { type, durationSeconds: 0 };
  }

  const rawDuration = baseDurationSeconds(emotion, energy);
  const shorterScene = Math.min(prevSceneDurationSeconds, nextSceneDurationSeconds);
  const maxAllowed = Math.max(0, shorterScene * MAX_TRANSITION_FRACTION);
  const durationSeconds = Math.min(rawDuration, maxAllowed);

  if (durationSeconds < MIN_TRANSITION_SECONDS) {
    return { type: "cut", durationSeconds: 0 };
  }

  return { type, durationSeconds };
}

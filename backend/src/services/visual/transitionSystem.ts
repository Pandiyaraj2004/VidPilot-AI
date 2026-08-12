/**
 * Transition system for the Phase 5 dynamic visual engine — mirrors
 * motionSystem.ts's table-driven approach. Maps (emotion, energy,
 * segmentIndex) -> TransitionType for the blend *into* that segment from
 * whatever preceded it.
 *
 * Deliberately biased toward "cut" being the common case: a professional
 * edit does not need a flashy transition between every pair of shots, and
 * a plain cut is itself a legitimate transition, not an absence of one.
 * The first segment of a scene is always "cut" — the scene boundary itself
 * is already the transition; there is nothing "previous" within the scene
 * to blend from.
 */

import type { TransitionType } from "../../types/index.js";

const HIGH_ENERGY_SEQUENCE: TransitionType[] = ["cut", "zoom", "cut", "cut"];
const MED_ENERGY_SEQUENCE: TransitionType[] = ["cut", "crossfade", "cut", "slide"];
const LOW_ENERGY_SEQUENCE: TransitionType[] = ["fade", "crossfade", "fade", "crossfade"];

const EMOTION_OVERRIDES: Partial<Record<string, TransitionType[]>> = {
  mystery: ["fade", "fade", "crossfade", "fade"],
  dramatic: ["cut", "fade", "zoom", "cut"],
  calm: ["fade", "crossfade", "fade", "crossfade"],
  serious: ["cut", "fade", "cut", "fade"],
  motivation: ["cut", "cut", "zoom", "cut"],
  excitement: ["cut", "zoom", "cut", "zoom"],
  curiosity: ["cut", "crossfade", "cut", "slide"],
  humorous: ["cut", "slide", "cut", "zoom"],
};

export function selectTransition(
  emotion: string | undefined,
  energy: number | undefined,
  segmentIndex: number
): TransitionType {
  if (segmentIndex <= 0) return "cut";

  const e = typeof energy === "number" ? Math.max(0, Math.min(1, energy)) : 0.5;
  const idx = segmentIndex - 1; // sequences describe transitions *between* segments, 0-indexed from the second segment

  if (emotion && EMOTION_OVERRIDES[emotion]) {
    const seq = EMOTION_OVERRIDES[emotion]!;
    return seq[idx % seq.length];
  }

  if (e >= 0.65) return HIGH_ENERGY_SEQUENCE[idx % HIGH_ENERGY_SEQUENCE.length];
  if (e >= 0.35) return MED_ENERGY_SEQUENCE[idx % MED_ENERGY_SEQUENCE.length];
  return LOW_ENERGY_SEQUENCE[idx % LOW_ENERGY_SEQUENCE.length];
}

/** Number of crossfade-blend frames for each transition type. "cut" is a hard 0 — the whole point of choosing it. */
export function transitionFadeFrames(transition: TransitionType): number {
  switch (transition) {
    case "cut": return 0;
    case "crossfade": return 8;
    case "fade": return 14;
    case "zoom": return 6;
    case "slide": return 8;
    default: return 8;
  }
}

/** Whether this transition adds an extra transform burst at the boundary (beyond the plain opacity crossfade), used by VisualSegmentLayer.tsx. */
export function transitionUsesTransformBurst(transition: TransitionType): boolean {
  return transition === "zoom" || transition === "slide";
}

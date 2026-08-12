/**
 * Motion system for the Phase 5 dynamic visual engine.
 *
 * Maps (emotion, energy, segmentIndex, totalSegments) → CameraMotion so
 * every visual segment has purposeful movement rather than random noise.
 *
 * Design rules:
 *   - High-energy scenes use impactful, faster motions (zoom_in, fast_impact, pan_*)
 *   - Low-energy / mystery scenes use slow, cinematic motions
 *   - Consecutive segments alternate direction to create visual interest
 *   - No two adjacent segments should use the exact same motion type
 *   - The "static" motion is reserved for calm / serious content where motion
 *     would distract from the information being presented
 */

import type { CameraMotion } from "../../types/index.js";

/** Motions suitable for high-energy content, alternated by segmentIndex. */
const HIGH_ENERGY_SEQUENCE: CameraMotion[] = ["zoom_in", "pan_right", "zoom_in", "pan_left", "fast_impact"];

/** Motions suitable for medium-energy content, alternated by segmentIndex. */
const MED_ENERGY_SEQUENCE: CameraMotion[] = ["zoom_in", "pan_left", "slow_cinematic", "pan_right", "zoom_out"];

/** Motions for low-energy / cinematic content. */
const LOW_ENERGY_SEQUENCE: CameraMotion[] = ["slow_cinematic", "pan_up", "slow_cinematic", "static", "zoom_out"];

/** Emotion-specific overrides that take precedence over the energy-based sequences. */
const EMOTION_OVERRIDES: Partial<Record<string, CameraMotion[]>> = {
  mystery:     ["slow_cinematic", "static", "slow_cinematic", "zoom_in", "slow_cinematic"],
  dramatic:    ["zoom_in", "slow_cinematic", "fast_impact", "pan_left", "slow_cinematic"],
  calm:        ["slow_cinematic", "static", "pan_up", "static", "slow_cinematic"],
  serious:     ["static", "slow_cinematic", "static", "pan_up", "static"],
  motivation:  ["zoom_in", "fast_impact", "pan_right", "zoom_in", "pan_left"],
  excitement:  ["fast_impact", "zoom_in", "pan_right", "fast_impact", "zoom_out"],
  curiosity:   ["zoom_in", "pan_left", "zoom_in", "pan_right", "slow_cinematic"],
  humorous:    ["zoom_in", "pan_right", "zoom_out", "pan_left", "fast_impact"],
};

/**
 * Selects the camera motion for one visual segment.
 *
 * @param emotion - Scene emotion string (may be undefined for old jobs)
 * @param energy  - Scene energy 0.0–1.0 (defaults to 0.5 if absent)
 * @param segmentIndex - Zero-based index of this segment within the scene
 * @param previousSceneLastMotion - Phase 8: the immediately preceding
 *   scene's last segment's motion. Only consulted when segmentIndex is 0
 *   (a scene's first segment is the only one that risks visually repeating
 *   what the viewer just saw a moment ago at the scene cut) — later
 *   segments within the same scene are already varied by the sequence's
 *   own alternation, so this is left out of scope for them.
 */
export function selectMotion(
  emotion: string | undefined,
  energy: number | undefined,
  segmentIndex: number,
  previousSceneLastMotion?: CameraMotion
): CameraMotion {
  const e = typeof energy === "number" ? Math.max(0, Math.min(1, energy)) : 0.5;
  const idx = Math.max(0, segmentIndex);

  // Emotion-specific override takes highest priority; otherwise fall back
  // to the energy-based sequences.
  const sequence: CameraMotion[] =
    emotion && EMOTION_OVERRIDES[emotion]
      ? EMOTION_OVERRIDES[emotion]!
      : e >= 0.65
        ? HIGH_ENERGY_SEQUENCE
        : e >= 0.35
          ? MED_ENERGY_SEQUENCE
          : LOW_ENERGY_SEQUENCE;

  let motion = sequence[idx % sequence.length];

  if (segmentIndex === 0 && previousSceneLastMotion && motion === previousSceneLastMotion && sequence.length > 1) {
    motion = sequence[(idx + 1) % sequence.length];
  }

  return motion;
}

/**
 * Returns whether the given motion is considered "high impact"
 * (used by the renderer to calibrate animation intensity).
 */
export function isHighImpactMotion(motion: CameraMotion): boolean {
  return motion === "fast_impact" || motion === "zoom_in";
}

/** Returns whether this motion requires extra overflow-hidden on the container to avoid clipping. */
export function motionRequiresClip(motion: CameraMotion): boolean {
  return motion !== "static";
}

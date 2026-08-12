/**
 * Visual Planning Engine — the core Phase 5 orchestrator.
 *
 * Takes an enriched VideoScene (with emotion/energy/sceneRole from the AI)
 * and the scene's real audio duration, and produces a VisualSegment[] that
 * forms the scene's visual timeline:
 *
 *   - Decides how many segments to create (1–4, based on energy + duration)
 *   - Divides the audio duration across segments
 *   - Assigns a palette per segment (emotion-keyed, varied by segment index)
 *   - Assigns a camera motion per segment (emotion + energy + index)
 *   - Plans content overlays (statistic cards, text cards, quote cards)
 *   - Returns segments whose timings sum exactly to audioDuration
 *
 * All computation is deterministic — same inputs always produce the same
 * VisualSegment[]. This makes re-renders after a partial failure reproduce
 * the same visual layout, matching the project's determinism principle.
 *
 * No external APIs. No randomness. Pure arithmetic and table lookups.
 */

import type { CameraMotion, CaptionStyle, VisualSegment, VideoScene } from "../../types/index.js";
import { getPaletteForEmotion } from "./emotionPalettes.js";
import { selectMotion } from "./motionSystem.js";
import { planContentOverlays } from "./contentOverlayPlanner.js";
import { determineCaptionStyle } from "./captionSystem.js";
import { selectTransition } from "./transitionSystem.js";

export interface VisualPlan {
  segments: VisualSegment[];
  captionStyle: CaptionStyle;
}

// --- Segment count determination ---

const SEGMENT_COUNT_BY_ENERGY_DURATION: {
  minEnergy: number;
  minDuration: number;
  count: number;
}[] = [
  // Very high energy (urgent/excitement), long enough scenes: cut fast, 5 segments
  { minEnergy: 0.85, minDuration: 6,  count: 5 },
  // Long high-energy scenes: 4 segments
  { minEnergy: 0.65, minDuration: 8,  count: 4 },
  // Medium-long high-energy scenes: 3 segments
  { minEnergy: 0.65, minDuration: 4,  count: 3 },
  // Short high-energy scenes: 2 segments
  { minEnergy: 0.65, minDuration: 0,  count: 2 },
  // Medium energy + longer: 3 segments
  { minEnergy: 0.35, minDuration: 7,  count: 3 },
  // Medium energy: 2 segments
  { minEnergy: 0.35, minDuration: 0,  count: 2 },
  // Low energy / very long: 2 segments
  { minEnergy: 0,    minDuration: 8,  count: 2 },
  // Low energy / short: 1 segment (minimal motion, calm)
  { minEnergy: 0,    minDuration: 0,  count: 1 },
];

function determineSegmentCount(energy: number, audioDuration: number): number {
  // Scenes shorter than 1.5s always get 1 segment — below this, even a Shorts-paced cut isn't meaningful.
  if (audioDuration < 1.5) return 1;

  for (const rule of SEGMENT_COUNT_BY_ENERGY_DURATION) {
    if (energy >= rule.minEnergy && audioDuration >= rule.minDuration) {
      return rule.count;
    }
  }
  return 1;
}

// --- Segment timing ---

/**
 * Divides audioDuration into `count` segments with slight variation so
 * segments feel hand-crafted rather than mechanically equal. The first
 * segment is slightly longer for impact; the last segment is exact to
 * avoid floating-point drift. All timings are clamped to audioDuration.
 */
function divideIntoSegments(audioDuration: number, count: number): Array<{ start: number; end: number }> {
  if (count === 1) return [{ start: 0, end: audioDuration }];

  // Base duration per segment with a slight variation on the first
  const base = audioDuration / count;
  const firstBonus = count > 2 ? base * 0.08 : 0; // first segment gets ~8% longer

  const durations: number[] = [];
  for (let i = 0; i < count; i++) {
    if (i === 0) {
      durations.push(base + firstBonus);
    } else if (i === count - 1) {
      // Exact remainder to avoid floating-point drift
      durations.push(audioDuration - durations.reduce((a, b) => a + b, 0));
    } else {
      durations.push(base - firstBonus / (count - 1));
    }
  }

  const result: Array<{ start: number; end: number }> = [];
  let cursor = 0;
  for (let i = 0; i < count; i++) {
    const start = parseFloat(cursor.toFixed(4));
    const end = parseFloat(Math.min(cursor + durations[i], audioDuration).toFixed(4));
    result.push({ start, end });
    cursor = end;
  }
  return result;
}

// --- Background kind selection (deterministic by scene id + index) ---

const BG_KINDS: Array<"gradient" | "solid" | "pattern"> = ["gradient", "gradient", "solid", "gradient", "pattern"];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function backgroundKindFor(sceneId: string, segmentIndex: number): "gradient" | "solid" | "pattern" {
  // Mostly gradients; occasionally solid or pattern for variety
  return BG_KINDS[hashString(`${sceneId}:${segmentIndex}:bg`) % BG_KINDS.length];
}

// --- Main planning function ---

/**
 * Produces the full visual plan for one scene.
 *
 * @param scene        The VideoScene with optional emotion/energy/sceneRole/highlightWords
 * @param audioDuration The scene's real measured audio duration in seconds
 * @param jobId        Job id used as a determinism seed for palette selection
 */
export function planSceneVisuals(
  scene: VideoScene,
  audioDuration: number,
  jobId: string,
  /** Phase 8: the immediately preceding scene's last segment's camera motion — lets selectMotion() avoid repeating it on this scene's own first segment. Undefined for the job's first scene (nothing precedes it). */
  previousSceneLastMotion?: CameraMotion
): VisualPlan {
  const emotion = scene.emotion;
  const energy = typeof scene.energy === "number" ? Math.max(0, Math.min(1, scene.energy)) : 0.5;
  const sceneRole = scene.sceneRole;

  // Determine how many segments this scene gets
  const segmentCount = determineSegmentCount(energy, audioDuration);

  // Divide the audio duration into segment time ranges
  const timeRanges = divideIntoSegments(audioDuration, segmentCount);

  // Plan content overlays (at most one per scene)
  const overlayPlans = planContentOverlays(segmentCount, {
    sceneRole,
    highlightWords: scene.highlightWords,
    onScreenText: scene.onScreenText,
  });

  // Build each segment
  const segments: VisualSegment[] = timeRanges.map((range, i) => {
    const segmentSeed = `${jobId}:${scene.id}:seg${i}`;
    const palette = getPaletteForEmotion(emotion, segmentSeed);
    const motion: CameraMotion = selectMotion(emotion, energy, i, i === 0 ? previousSceneLastMotion : undefined);
    const transition = selectTransition(emotion, energy, i);
    const overlay = overlayPlans[i];
    const bgKind = backgroundKindFor(scene.id, i);

    return {
      id: `${scene.id}-seg${i}`,
      startTime: range.start,
      endTime: range.end,
      // Procedural by default — dynamicVisualProvider.ts may replace this
      // with a real image/video asset after a successful licensed search.
      mediaKind: "color",
      backgroundKind: bgKind,
      colors: palette.colors,
      accentColor: palette.accent,
      cameraMotion: motion,
      transition,
      contentType: overlay?.contentType ?? "none",
      contentValue: overlay?.contentValue,
      contentLabel: overlay?.contentLabel,
    };
  });

  // Determine caption style
  const captionStyle = determineCaptionStyle(sceneRole, energy);

  return { segments, captionStyle };
}

/**
 * Validates that segments are within bounds and non-overlapping.
 * Returns an array of error strings (empty = valid).
 */
export function validateSegments(segments: VisualSegment[], audioDuration: number): string[] {
  const errors: string[] = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg.startTime < 0) errors.push(`Segment ${i} startTime is negative.`);
    if (seg.endTime > audioDuration + 0.01) {
      errors.push(`Segment ${i} endTime (${seg.endTime.toFixed(3)}) exceeds audio duration (${audioDuration.toFixed(3)}).`);
    }
    if (seg.endTime <= seg.startTime) {
      errors.push(`Segment ${i} has zero or negative duration.`);
    }
    if (i > 0 && segments[i - 1].endTime > seg.startTime + 0.01) {
      errors.push(`Segment ${i} overlaps with segment ${i - 1}.`);
    }
  }
  return errors;
}

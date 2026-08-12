/**
 * Caption reveal pacing — how fast words appear and how strongly an
 * emphasized word pops, driven by the same (emotion, energy, sceneRole)
 * signals the Phase 5 visual motion/transition systems already use
 * (services/visual/motionSystem.ts, transitionSystem.ts), not a new
 * category system. Precedence mirrors captionSystem.ts's own
 * determineCaptionStyle: a sceneRole-specific override wins first (a
 * "reveal" scene wants a slow build-up to its payoff regardless of the
 * scene's raw energy number), then an emotion override, then the same
 * energy tiers (>=0.65 high / >=0.35 medium / else low, default 0.5) used
 * by motionSystem.ts/transitionSystem.ts.
 *
 * `popPeakScale` stays at or below 1.16 — comfortably under the 1.18
 * safety factor subtitleLayout.ts already reserves box width/height for
 * (HIGHLIGHT_WIDTH_SAFETY_FACTOR), since a highlighted word's *static*
 * font size is already 1.18x normal; the pop is a brief additional
 * transform on top of that, not a second independent size increase.
 */

export interface CaptionPacing {
  /** Frames for one word's reveal transition (opacity/scale/translateY ramp-in). */
  revealFrames: number;
  /** Peak transform scale during an emphasized word's pop, e.g. 1.10 = 10% larger at peak. 1.0 = no visible pop. */
  popPeakScale: number;
  /** Whether emphasized words pop at all — some moods (calm, serious) should stay restrained. */
  popEnabled: boolean;
}

const HIGH_ENERGY_THRESHOLD = 0.65;
const MED_ENERGY_THRESHOLD = 0.35;

const SCENE_ROLE_OVERRIDES: Partial<Record<string, CaptionPacing>> = {
  // A reveal scene's payoff deserves a slower build and the strongest pop.
  reveal: { revealFrames: 7, popPeakScale: 1.16, popEnabled: true },
  // A question needs a beat to register before the next word lands.
  question: { revealFrames: 6, popPeakScale: 1.08, popEnabled: true },
};

/** Same 8-emotion set as motionSystem.ts's EMOTION_OVERRIDES / transitionSystem.ts, so a scene's mood drives caption pacing the same way it already drives camera motion. */
const EMOTION_PACING: Partial<Record<string, CaptionPacing>> = {
  mystery: { revealFrames: 6, popPeakScale: 1.06, popEnabled: true },
  dramatic: { revealFrames: 5, popPeakScale: 1.1, popEnabled: true },
  calm: { revealFrames: 7, popPeakScale: 1.0, popEnabled: false },
  serious: { revealFrames: 6, popPeakScale: 1.0, popEnabled: false },
  motivation: { revealFrames: 3, popPeakScale: 1.15, popEnabled: true },
  excitement: { revealFrames: 3, popPeakScale: 1.14, popEnabled: true },
  curiosity: { revealFrames: 4, popPeakScale: 1.1, popEnabled: true },
  humorous: { revealFrames: 4, popPeakScale: 1.1, popEnabled: true },
};

const HIGH_ENERGY_PACING: CaptionPacing = { revealFrames: 3, popPeakScale: 1.12, popEnabled: true };
const MED_ENERGY_PACING: CaptionPacing = { revealFrames: 5, popPeakScale: 1.08, popEnabled: true };
const LOW_ENERGY_PACING: CaptionPacing = { revealFrames: 7, popPeakScale: 1.0, popEnabled: false };

export function getCaptionPacing(
  emotion: string | null | undefined,
  energy: number | undefined,
  sceneRole: string | null | undefined
): CaptionPacing {
  if (sceneRole && SCENE_ROLE_OVERRIDES[sceneRole]) {
    return SCENE_ROLE_OVERRIDES[sceneRole]!;
  }

  if (emotion && EMOTION_PACING[emotion]) {
    return EMOTION_PACING[emotion]!;
  }

  const e = typeof energy === "number" ? Math.max(0, Math.min(1, energy)) : 0.5;
  if (e >= HIGH_ENERGY_THRESHOLD) return HIGH_ENERGY_PACING;
  if (e >= MED_ENERGY_THRESHOLD) return MED_ENERGY_PACING;
  return LOW_ENERGY_PACING;
}

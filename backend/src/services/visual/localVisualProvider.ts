import { BACKGROUND_KINDS, PALETTES, candidateTemplatesForStyle } from "./templates.js";
import { VisualProviderError, type VisualInput, type VisualProvider, type VisualResult } from "./visualProvider.js";
import { planSceneVisuals } from "./visualPlanningEngine.js";

/** Deterministic (not cryptographic) — same input always yields the same output, which is what makes retries reproducible. */
function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/**
 * Phase 5 local visual provider: deterministic, no paid AI image API.
 *
 * Now produces a full multi-segment visual timeline (VisualResult.segments)
 * via the visual planning engine, driven by scene emotion/energy/sceneRole.
 * The template, backgroundKind, colors, and accentColor are still set for
 * backward-compatibility with any code that reads the legacy single-segment
 * fields — these come from the first segment's palette.
 *
 * If the scene has no audio.duration (voice not yet generated), planning
 * falls back to a single segment using the legacy template+palette approach,
 * so visual generation remains safe to run before voice generation.
 */
export class LocalVisualProvider implements VisualProvider {
  readonly name = "local-deterministic" as const;

  async generateVisual(input: VisualInput): Promise<VisualResult> {
    if (!input.narration.trim() && !input.onScreenText.trim()) {
      throw new VisualProviderError("invalid_input", "Scene has no narration or on-screen text to visualize.");
    }

    // Template selection: job-scoped, deterministic, style-aware
    const forceCartoon = input.visualStyleSetting === "cartoon";
    const candidates = forceCartoon ? (["cartoon"] as const) : candidateTemplatesForStyle(input.jobStyle);
    const template = candidates[hashString(`${input.jobId}:template`) % candidates.length];

    // --- Phase 5: Multi-segment visual plan ---
    const audioDuration = input.audioDuration;
    if (audioDuration && audioDuration > 0) {
      const plan = planSceneVisuals(
        {
          id: input.sceneId,
          order: input.sceneOrder,
          narration: input.narration,
          visualDescription: input.visualDescription,
          onScreenText: input.onScreenText,
          estimatedDuration: audioDuration,
          emotion: input.emotion,
          energy: input.energy,
          sceneRole: input.sceneRole,
          highlightWords: input.highlightWords,
          musicMood: input.musicMood,
        },
        audioDuration,
        input.jobId,
        input.previousSceneLastMotion
      );

      // Use the first segment's palette for the legacy single-background fields
      const firstSeg = plan.segments[0];

      return {
        template,
        backgroundKind: firstSeg?.backgroundKind ?? "gradient",
        colors: firstSeg ? [...firstSeg.colors] : ["#312e81", "#7c3aed"],
        accentColor: firstSeg?.accentColor ?? "#facc15",
        segments: plan.segments,
        emotion: input.emotion,
        captionStyle: plan.captionStyle,
      };
    }

    // --- Fallback: no audio duration yet, use legacy single-background approach ---
    const palette = PALETTES[hashString(`${input.jobId}:palette`) % PALETTES.length];
    const backgroundKind = BACKGROUND_KINDS[hashString(`${input.jobId}:${input.sceneOrder}:bg`) % BACKGROUND_KINDS.length];

    return {
      template,
      backgroundKind,
      colors: [...palette.colors],
      accentColor: palette.accent,
      // No segments — renderer will use fallback single-background path
    };
  }
}

import { config } from "../../config/env.js";
import type { CameraMotion, VideoScene, VideoStyle, VisualStyle, VisualTemplate } from "../../types/index.js";
import { DynamicVisualProvider } from "./dynamicVisualProvider.js";
import { VisualProviderError, type VisualProvider } from "./visualProvider.js";

const MAX_ATTEMPTS_PER_SCENE = 2;
const NON_RETRYABLE_KINDS = new Set(["invalid_input"]);

export interface VisualEngineOptions {
  jobId: string;
  jobStyle: VideoStyle;
  visualStyleSetting: VisualStyle;
  language: string;
  scenes: VideoScene[];
  force?: boolean;
  targetSceneId?: string;
}

export interface VisualEngineResult {
  scenes: VideoScene[];
  allReady: boolean;
  failedSceneIds: string[];
  /** The template every scene landed on — template selection is per-job (see localVisualProvider.ts), so this is the same value across all scenes. */
  template: VisualTemplate | null;
}

function shouldProcess(scene: VideoScene, options: VisualEngineOptions): boolean {
  if (options.targetSceneId) return scene.id === options.targetSceneId;
  if (options.force) return true;
  return scene.visual?.status !== "ready";
}

/**
 * Assigns every scene that needs it a visual treatment, mirroring
 * voiceEngine's per-scene retry/partial-failure shape. Never touches
 * narration/audio — this stage only ever reads scene text, it doesn't
 * regenerate anything upstream.
 *
 * Phase 5: passes real audio duration and scene metadata (emotion, energy,
 * sceneRole, highlightWords) to the provider so the planning engine can
 * produce a multi-segment visual timeline. The audio duration comes from
 * scene.audio.duration (set by Phase 4); if absent (voice not yet generated),
 * the provider falls back to the legacy single-background approach.
 */
export async function runVisualGeneration(
  options: VisualEngineOptions,
  provider: VisualProvider = new DynamicVisualProvider()
): Promise<VisualEngineResult> {
  const updatedScenes: VideoScene[] = [];
  const failedSceneIds: string[] = [];
  let template: VisualTemplate | null = null;
  // In-job repetition avoidance: every internet asset used by an earlier
  // scene in this same run is passed forward so later scenes prefer a
  // different asset when one is available. Cross-job avoidance is Phase 7.
  const recentSourceKeys: string[] = [];
  const maxAssets = config.visuals.maxAssetsPerJob;
  let assetBudgetWarned = false;
  // Phase 8 — cross-scene camera-motion continuity: the previous scene's
  // last segment's motion, so the next scene's first segment can avoid
  // repeating it right at the cut. Threaded the same way recentSourceKeys
  // already is above.
  let previousSceneLastMotion: CameraMotion | undefined;

  for (const scene of options.scenes) {
    if (!shouldProcess(scene, options)) {
      updatedScenes.push(scene);
      if (scene.visual?.status === "ready" && scene.visual.template) {
        template = scene.visual.template;
      }
      const lastSegment = scene.visual?.segments?.[scene.visual.segments.length - 1];
      if (lastSegment) previousSceneLastMotion = lastSegment.cameraMotion;
      continue;
    }

    let lastErrorMessage = "Visual generation failed for an unknown reason.";
    let succeeded = false;

    const overBudget = recentSourceKeys.length >= maxAssets;
    if (overBudget && !assetBudgetWarned) {
      assetBudgetWarned = true;
      console.error(
        `[VidPilot] Job ${options.jobId} reached its visual-asset budget (${maxAssets}); remaining scenes use procedural fallback visuals instead of new internet lookups.`
      );
    }

    for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_SCENE; attempt++) {
      try {
        const result = await provider.generateVisual({
          sceneId: scene.id,
          sceneOrder: scene.order,
          jobId: options.jobId,
          narration: scene.narration,
          onScreenText: scene.onScreenText,
          visualDescription: scene.visualDescription,
          language: options.language,
          jobStyle: options.jobStyle,
          visualStyleSetting: options.visualStyleSetting,
          // Phase 5 — real audio duration enables multi-segment planning
          audioDuration: scene.audio?.status === "ready" ? scene.audio.duration : undefined,
          // Phase 5 — scene-level metadata from AI
          emotion: scene.emotion,
          energy: scene.energy,
          sceneRole: scene.sceneRole,
          highlightWords: scene.highlightWords,
          musicMood: scene.musicMood,
          // Phase 5 upgrade — internet visual sourcing
          visualKeywords: scene.visualKeywords,
          recentSourceKeys,
          skipInternetSearch: overBudget,
          previousSceneLastMotion,
        });

        updatedScenes.push({
          ...scene,
          visual: {
            status: "ready",
            template: result.template,
            backgroundKind: result.backgroundKind,
            colors: result.colors,
            accentColor: result.accentColor,
            // Phase 5: multi-segment timeline and metadata
            segments: result.segments,
            assets: result.assets,
            emotion: result.emotion,
            captionStyle: result.captionStyle,
          },
        });
        template = result.template;
        if (result.usedSourceKeys) recentSourceKeys.push(...result.usedSourceKeys);
        const newLastSegment = result.segments?.[result.segments.length - 1];
        if (newLastSegment) previousSceneLastMotion = newLastSegment.cameraMotion;
        succeeded = true;
        break;
      } catch (err) {
        lastErrorMessage = err instanceof Error ? err.message : String(err);
        if (err instanceof VisualProviderError && NON_RETRYABLE_KINDS.has(err.kind)) {
          break;
        }
      }
    }

    if (!succeeded) {
      failedSceneIds.push(scene.id);
      updatedScenes.push({
        ...scene,
        visual: { status: "failed", error: lastErrorMessage },
      });
    }
  }

  return {
    scenes: updatedScenes,
    allReady: failedSceneIds.length === 0,
    failedSceneIds,
    template,
  };
}

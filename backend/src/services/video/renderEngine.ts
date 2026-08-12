import { config } from "../../config/env.js";
import type { ContentCategory, VideoScene } from "../../types/index.js";
import { concatScenesWithTransitions, type SceneTransitionSpec } from "./sceneTransitionConcat.js";
import { planSceneTransition, type SceneTransitionType } from "./sceneTransitionPlanner.js";
import { ensureJobOutputDir, ensureJobRenderDir, getFinalVideoPath, getSceneRenderPath } from "./videoStorage.js";
import { renderScene, withRenderBrowser } from "./remotionRenderer.js";

export interface RenderEngineOptions {
  jobId: string;
  language: string;
  scenes: VideoScene[];
  /** Phase 8 — drives cross-scene transition selection (services/video/sceneTransitionPlanner.ts) the same way it already drives music-folder selection. Optional so older callers/tests without it still work — transitions just fall back to the planner's default candidate list. */
  contentCategory?: ContentCategory;
}

export interface RenderEngineResult {
  finalVideoPath: string;
  totalDurationSeconds: number;
}

/**
 * Renders every scene, then combines them into the job's final MP4 with
 * real cross-scene transitions (Phase 8). Every scene must already have
 * ready audio, a ready visual, and subtitles — this stage never
 * regenerates any of those; a missing prerequisite is a bug in the caller
 * (jobService gates the pipeline before reaching here), not a retryable
 * render failure. Unlike voice/visual generation, a render retry always
 * re-renders every scene: Remotion rendering is local and free (no metered
 * API call to protect), so there is no reason to skip scenes whose file
 * already happens to exist on disk.
 *
 * Phase 5: passes multi-segment visual data (segments, emotion, sceneRole,
 * highlightWords, captionStyle) through to renderScene so the Remotion
 * composition can render dynamic multi-segment visuals with camera motion.
 *
 * Phase 8: each scene is still rendered independently (unchanged), but the
 * final combine step now picks a real transition per scene boundary
 * (services/video/sceneTransitionPlanner.ts) and blends it in with ffmpeg's
 * xfade/acrossfade filters (services/video/sceneTransitionConcat.ts) —
 * falling back to the original fast stream-copy concat automatically when
 * every boundary turns out to be a plain cut.
 */
export async function renderJobVideo(options: RenderEngineOptions): Promise<RenderEngineResult> {
  await ensureJobRenderDir(options.jobId);
  await ensureJobOutputDir(options.jobId);

  const sortedScenes = [...options.scenes].sort((a, b) => a.order - b.order);
  const sceneVideoPaths: string[] = [];
  const sceneDurations: number[] = [];
  const transitions: SceneTransitionSpec[] = [];
  const recentTransitions: SceneTransitionType[] = [];
  let totalDurationSeconds = 0;

  await withRenderBrowser(async (browser) => {
    for (const scene of sortedScenes) {
      if (scene.audio?.status !== "ready" || !scene.audio.duration) {
        throw new Error(`Scene ${scene.id} has no ready narration audio; cannot render.`);
      }
      if (scene.visual?.status !== "ready" || !scene.visual.template) {
        throw new Error(`Scene ${scene.id} has no ready visual; cannot render.`);
      }
      if (!scene.subtitles || scene.subtitles.length === 0) {
        throw new Error(`Scene ${scene.id} has no subtitles; cannot render.`);
      }

      const outputPath = getSceneRenderPath(options.jobId, scene.order);
      const audioUrl = `http://127.0.0.1:${config.port}/api/jobs/${options.jobId}/scenes/${scene.id}/audio`;

      // Validate Phase 5 segments if present: no segment should exceed audio duration
      if (scene.visual.segments && scene.visual.segments.length > 0) {
        for (const seg of scene.visual.segments) {
          if (seg.endTime > scene.audio.duration + 0.05) {
            throw new Error(
              `Scene ${scene.id} segment ${seg.id} endTime (${seg.endTime.toFixed(3)}s) ` +
              `exceeds audio duration (${scene.audio.duration.toFixed(3)}s).`
            );
          }
        }
      }

      // Resolve each segment's assetId to a fetchable URL the same way
      // audioUrl above resolves a scene's audio — Remotion's headless Chrome
      // can only fetch http(s), never a raw local filesystem path.
      const segmentsWithMediaUrls = scene.visual.segments?.map((seg) => ({
        ...seg,
        mediaUrl:
          seg.mediaKind !== "color" && seg.assetId
            ? `http://127.0.0.1:${config.port}/api/jobs/${options.jobId}/visuals/${seg.assetId}`
            : undefined,
      }));

      await renderScene(
        {
          outputPath,
          durationInSeconds: scene.audio.duration,
          template: scene.visual.template,
          backgroundKind: (scene.visual.backgroundKind as "gradient" | "solid" | "pattern") ?? "gradient",
          colors: (scene.visual.colors as [string, string] | undefined) ?? ["#312e81", "#7c3aed"],
          accentColor: scene.visual.accentColor ?? "#facc15",
          onScreenText: scene.onScreenText,
          language: options.language,
          subtitles: scene.subtitles,
          audioUrl,
          // Phase 5 — multi-segment visual data
          segments: segmentsWithMediaUrls,
          emotion: scene.visual.emotion,
          energy: scene.energy,
          sceneRole: scene.sceneRole,
          highlightWords: scene.highlightWords,
          captionStyle: scene.visual.captionStyle,
        },
        browser
      );

      // Phase 8 — plan the transition INTO this scene from whatever
      // preceded it (mirrors transitionSystem.ts's own "transition into
      // this segment" convention). The first scene has no boundary before
      // it, so this only runs from the second scene onward.
      if (sceneVideoPaths.length > 0) {
        const previousDuration = sceneDurations[sceneDurations.length - 1];
        const plan = planSceneTransition(
          options.contentCategory,
          scene.visual?.emotion ?? scene.emotion,
          scene.energy,
          transitions.length,
          previousDuration,
          scene.audio.duration,
          recentTransitions
        );
        transitions.push(plan);
        recentTransitions.push(plan.type);
      }

      sceneVideoPaths.push(outputPath);
      sceneDurations.push(scene.audio.duration);
      totalDurationSeconds += scene.audio.duration;
    }
  });

  const finalVideoPath = getFinalVideoPath(options.jobId);
  const { finalDurationSeconds } = await concatScenesWithTransitions(sceneVideoPaths, sceneDurations, transitions, finalVideoPath);

  return { finalVideoPath, totalDurationSeconds: finalDurationSeconds };
}

import type { SubtitleCue, VideoScene } from "../../types/index.js";
import { distributeTiming, segmentNarration } from "./subtitleTiming.js";

export interface SubtitleEngineOptions {
  scenes: VideoScene[];
  maxCharsPerCue?: number;
  force?: boolean;
  targetSceneId?: string;
}

export interface SubtitleEngineResult {
  scenes: VideoScene[];
  allReady: boolean;
  failedSceneIds: string[];
}

function shouldProcess(scene: VideoScene, options: SubtitleEngineOptions): boolean {
  if (options.targetSceneId) return scene.id === options.targetSceneId;
  if (options.force) return true;
  return !scene.subtitles || scene.subtitles.length === 0;
}

/**
 * Segments each scene's narration into timed cues using its real, measured
 * audio.duration (never estimatedDuration). Pure text/arithmetic — no
 * external process, so the only way a scene "fails" here is if voice
 * generation hasn't produced a real duration for it yet; that scene is
 * reported failed rather than silently guessed at.
 */
export function runSubtitleGeneration(options: SubtitleEngineOptions): SubtitleEngineResult {
  const updatedScenes: VideoScene[] = [];
  const failedSceneIds: string[] = [];

  for (const scene of options.scenes) {
    if (!shouldProcess(scene, options)) {
      updatedScenes.push(scene);
      continue;
    }

    if (scene.audio?.status !== "ready" || !scene.audio.duration) {
      failedSceneIds.push(scene.id);
      updatedScenes.push(scene);
      continue;
    }

    const segments = segmentNarration(scene.narration, options.maxCharsPerCue);
    const timed = distributeTiming(segments, scene.audio.duration);

    if (timed.length === 0) {
      failedSceneIds.push(scene.id);
      updatedScenes.push(scene);
      continue;
    }

    const subtitles: SubtitleCue[] = timed.map((cue, index) => ({
      index,
      text: cue.text,
      startSeconds: cue.startSeconds,
      endSeconds: cue.endSeconds,
    }));

    updatedScenes.push({ ...scene, subtitles });
  }

  return {
    scenes: updatedScenes,
    allReady: failedSceneIds.length === 0,
    failedSceneIds,
  };
}

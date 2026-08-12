/**
 * Scene synchronization (Phase 9) — cross-checks the real, already-measured
 * values different engines each recorded independently: does a scene's
 * visual timeline actually cover its own real audio duration, do its
 * captions actually end where its audio does, and does the final video's
 * overall real duration make sense against the sum of scene audio.
 *
 * That last check needs a wider tolerance than a simple per-scene one:
 * since Phase 8, the final video is genuinely *shorter* than the naive sum
 * of scene durations whenever a real cross-scene transition blended two
 * scenes together (the overlap is counted once, not twice — see
 * services/video/sceneTransitionConcat.ts). A job with several scenes can
 * legitimately be a couple of seconds shorter than that sum; this isn't
 * drift; it's each transition's own duration accumulated.
 */

import type { QualityCheckResult, QualityIssue, VideoJob } from "../../types/index.js";

const SCENE_LEVEL_TOLERANCE_SECONDS = 0.15;
// Real transitions are clamped to at most ~0.8s each (see
// sceneTransitionPlanner.ts's SLOW_EMOTIONS band) — this allows for every
// boundary in a job to have blended at close to that ceiling, which is
// already a generous upper bound in practice (most are 0.2-0.4s).
const MAX_PLAUSIBLE_TRANSITION_SECONDS = 0.8;

export function validateSyncQuality(job: VideoJob): QualityCheckResult {
  const issues: QualityIssue[] = [];
  const scenes = job.content?.scenes ?? [];

  let sumSceneAudio = 0;
  for (const scene of scenes) {
    const audioDuration = scene.audio?.duration;
    if (audioDuration == null) {
      issues.push({ severity: "critical", sceneId: scene.id, message: "Scene has no measured audio duration to synchronize against." });
      continue;
    }
    sumSceneAudio += audioDuration;

    const segments = scene.visual?.segments ?? [];
    if (segments.length > 0) {
      const lastSegmentEnd = Math.max(...segments.map((s) => s.endTime));
      if (audioDuration - lastSegmentEnd > SCENE_LEVEL_TOLERANCE_SECONDS) {
        issues.push({
          severity: "error",
          sceneId: scene.id,
          message: `Scene's visual timeline ends at ${lastSegmentEnd.toFixed(2)}s but narration runs to ${audioDuration.toFixed(2)}s — the screen would go blank before narration finishes.`,
        });
      }
    }

    const cues = scene.subtitles ?? [];
    if (cues.length > 0) {
      const lastCueEnd = Math.max(...cues.map((c) => c.endSeconds));
      if (lastCueEnd - audioDuration > SCENE_LEVEL_TOLERANCE_SECONDS) {
        issues.push({
          severity: "error",
          sceneId: scene.id,
          message: `Scene's last caption ends at ${lastCueEnd.toFixed(2)}s, after its own narration duration (${audioDuration.toFixed(2)}s).`,
        });
      }
    }
  }

  const finalDuration = job.videoRender?.durationSeconds;
  const boundaryCount = Math.max(0, scenes.length - 1);
  const maxExplainableShrink = boundaryCount * MAX_PLAUSIBLE_TRANSITION_SECONDS;

  if (finalDuration != null && sumSceneAudio > 0) {
    const shrink = sumSceneAudio - finalDuration;
    if (shrink > maxExplainableShrink + 1) {
      issues.push({
        severity: "error",
        message: `The final video (${finalDuration.toFixed(2)}s) is shorter than the sum of scene narration (${sumSceneAudio.toFixed(2)}s) by more than real scene transitions could explain (max ~${maxExplainableShrink.toFixed(2)}s) — a scene may be missing or truncated.`,
      });
    } else if (shrink < -1) {
      issues.push({
        severity: "error",
        message: `The final video (${finalDuration.toFixed(2)}s) is longer than the sum of scene narration (${sumSceneAudio.toFixed(2)}s) — unexpected extra content or a duplicated scene.`,
      });
    }
  }

  const hasCritical = issues.some((i) => i.severity === "critical");
  const hasError = issues.some((i) => i.severity === "error");
  const status = hasCritical || hasError ? "FAIL" : issues.length > 0 ? "WARN" : "PASS";

  return {
    status,
    details: { sumSceneAudioSeconds: sumSceneAudio, finalVideoDurationSeconds: finalDuration ?? null, sceneCount: scenes.length },
    issues,
  };
}

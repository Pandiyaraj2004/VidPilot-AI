/**
 * Visual integrity (Phase 9). Reuses visualPlanningEngine.ts's own
 * validateSegments (already enforces non-overlapping, in-bounds segment
 * timing — the same function the render pipeline itself trusts) instead
 * of re-deriving those rules here. Black-frame detection is NOT re-run
 * per scene: the whole final video was already decoded once for
 * blackdetect during the original render's validateVideoFile call — doing
 * it again per scene here would be exactly the redundant decoding the
 * spec's performance section warns against. The already-real
 * whole-video result is what's surfaced instead.
 */

import type { QualityCheckResult, QualityIssue, VideoScene } from "../../types/index.js";
import { validateSegments } from "../visual/visualPlanningEngine.js";

export function validateVisualQuality(scenes: VideoScene[]): QualityCheckResult {
  const issues: QualityIssue[] = [];
  let missingAssets = 0;
  let segmentErrors = 0;

  let previousAssetKey: string | null = null;
  let repeatRun = 1;

  for (const scene of scenes) {
    if (!scene.visual || scene.visual.status !== "ready") {
      issues.push({ severity: "critical", sceneId: scene.id, message: "Scene has no ready visual." });
      continue;
    }

    const segments = scene.visual.segments ?? [];
    if (segments.length > 0 && scene.audio?.duration != null) {
      const errors = validateSegments(segments, scene.audio.duration);
      segmentErrors += errors.length;
      for (const err of errors) {
        issues.push({ severity: "error", sceneId: scene.id, message: err });
      }
    }

    const assetById = new Map((scene.visual.assets ?? []).map((a) => [a.id, a]));
    for (const seg of segments) {
      if (seg.mediaKind !== "color" && seg.assetId && !assetById.has(seg.assetId)) {
        missingAssets += 1;
        issues.push({ severity: "error", sceneId: scene.id, message: `Segment references asset "${seg.assetId}" that isn't recorded in this scene's asset list.` });
      }
    }

    // Cross-scene repetition: same asset (or same procedural seed, when no
    // internet asset was used) used in 3+ consecutive scenes in a row —
    // WARN only, since a short deliberate repeat is a legitimate editorial
    // choice, not a bug. Compares the first real asset id per scene (or
    // "procedural" as a stand-in when none was used).
    const firstAssetId = segments.find((s) => s.assetId)?.assetId ?? "procedural";
    if (firstAssetId === previousAssetKey) {
      repeatRun += 1;
    } else {
      repeatRun = 1;
    }
    if (repeatRun === 3) {
      issues.push({ severity: "warn", sceneId: scene.id, message: `The same visual ("${firstAssetId}") has now repeated across 3 consecutive scenes.` });
    }
    previousAssetKey = firstAssetId;
  }

  const hasCritical = issues.some((i) => i.severity === "critical");
  const hasError = issues.some((i) => i.severity === "error");
  const status = hasCritical || hasError ? "FAIL" : issues.length > 0 ? "WARN" : "PASS";

  return {
    status,
    details: { scenesChecked: scenes.length, missingAssets, segmentErrors },
    issues,
  };
}

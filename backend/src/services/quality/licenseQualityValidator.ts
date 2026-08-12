/**
 * License/attribution completeness (Phase 9) — confirms the license
 * metadata Phase 5 (visuals) and Phase 6 (music) already verify *before
 * ever using* an asset actually survived intact onto the job record. This
 * never re-verifies a license against the source (no network calls, no
 * re-downloading — QC validates what was already generated, per spec),
 * it only catches the metadata having been silently dropped somewhere
 * between generation and this point.
 */

import type { QualityCheckResult, QualityIssue, VideoJob } from "../../types/index.js";

export function validateLicenseQuality(job: VideoJob): QualityCheckResult {
  const issues: QualityIssue[] = [];
  const scenes = job.content?.scenes ?? [];
  let assetsChecked = 0;
  let musicTracksChecked = 0;

  for (const scene of scenes) {
    for (const asset of scene.visual?.assets ?? []) {
      assetsChecked += 1;
      if (asset.provider === "procedural") continue; // no external source, nothing to attribute
      if (!asset.license || !asset.license.trim()) {
        issues.push({ severity: "error", sceneId: scene.id, message: `Visual asset from ${asset.provider} has no recorded license.` });
      }
      if (asset.attributionRequired && !asset.attributionText?.trim()) {
        issues.push({ severity: "error", sceneId: scene.id, message: `Visual asset from ${asset.provider} requires attribution but none is recorded.` });
      }
    }

    if (scene.audio?.musicTrack) {
      musicTracksChecked += 1;
      if (!scene.audio.musicLicense || !scene.audio.musicLicense.trim()) {
        issues.push({ severity: "error", sceneId: scene.id, message: `Background music "${scene.audio.musicTrack}" has no recorded license.` });
      }
      if (scene.audio.musicAttributionRequired && !scene.audio.musicAttributionText?.trim()) {
        issues.push({ severity: "error", sceneId: scene.id, message: `Background music "${scene.audio.musicTrack}" requires attribution but none is recorded.` });
      }
    }
  }

  const hasError = issues.some((i) => i.severity === "error" || i.severity === "critical");
  const status = hasError ? "FAIL" : issues.length > 0 ? "WARN" : "PASS";

  return {
    status,
    details: { assetsChecked, musicTracksChecked },
    issues,
  };
}

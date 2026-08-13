/**
 * Quality Control engine (Phase 9) — runs every validator against the
 * ACTUAL generated job/video, never against configuration or expected
 * values, and combines their results into one report with a transparent
 * score. A high score can never paper over a critical defect: any
 * "critical" issue anywhere, or any single category outright FAILing,
 * forces the overall result to FAIL regardless of the numeric score
 * (spec section 17/28) — the score is a summary for humans, not the
 * pass/fail authority itself.
 */

import type { QualityCategory, QualityCheckResult, QualityIssue, QualityReport, VideoJob } from "../../types/index.js";
import { validateVideoQuality } from "./videoQualityValidator.js";
import { validateAudioQuality } from "./audioQualityValidator.js";
import { validateSubtitleQuality } from "./subtitleQualityValidator.js";
import { validateVisualQuality } from "./visualQualityValidator.js";
import { validateSyncQuality } from "./syncQualityValidator.js";
import { validateMetadataQuality } from "./metadataQualityValidator.js";
import { validateLicenseQuality } from "./licenseQualityValidator.js";
import { validateContentQuality, type ContentQualityProvider } from "./contentQualityValidator.js";

/**
 * Score weight per category (section 17 of the Phase 9 spec) — sums to 100.
 * License is folded into a smaller slice than a full category: it's a
 * completeness check on metadata other categories already carry, not a
 * separate quality dimension a viewer would notice.
 */
const CATEGORY_WEIGHTS: Record<QualityCategory, number> = {
  video: 20,
  audio: 20,
  captions: 15,
  visuals: 15,
  sync: 15,
  metadata: 7,
  content: 5,
  license: 3,
};

function categoryScore(result: QualityCheckResult, weight: number): number {
  if (result.status === "PASS") return weight;
  if (result.status === "WARN") return weight * 0.6;
  return 0;
}

function collectIssues(results: QualityCheckResult[]): { warnings: QualityIssue[]; failures: QualityIssue[] } {
  const warnings: QualityIssue[] = [];
  const failures: QualityIssue[] = [];
  for (const r of results) {
    for (const issue of r.issues) {
      if (issue.severity === "error" || issue.severity === "critical") failures.push(issue);
      else warnings.push(issue);
    }
  }
  return { warnings, failures };
}

import { ensureLocalVideoFile } from "../video/videoStorage.js";

export async function runQualityControl(job: VideoJob, contentProvider?: ContentQualityProvider): Promise<QualityReport> {
  const scenes = job.content?.scenes ?? [];
  let videoPath = job.videoRender?.path ?? null;
  let localVideoRender = job.videoRender;

  if (videoPath) {
    const localVideoPath = await ensureLocalVideoFile(job.id, videoPath);
    videoPath = localVideoPath;
    if (job.videoRender) {
      localVideoRender = {
        ...job.videoRender,
        path: localVideoPath,
      };
    }
  }

  const [video, audio] = await Promise.all([
    validateVideoQuality(localVideoRender),
    validateAudioQuality(videoPath),
  ]);
  const captions = validateSubtitleQuality(scenes);
  const visuals = validateVisualQuality(scenes);
  const sync = validateSyncQuality(job);
  const metadata = validateMetadataQuality(job);
  const license = validateLicenseQuality(job);
  const content = validateContentQuality(scenes, contentProvider);

  const results: Record<QualityCategory, QualityCheckResult> = {
    video,
    audio,
    captions,
    visuals,
    sync,
    metadata,
    content,
    license,
  };

  const allResults = Object.values(results);
  const { warnings, failures } = collectIssues(allResults);

  const rawScore = (Object.keys(results) as (keyof typeof results)[]).reduce(
    (sum, key) => sum + categoryScore(results[key], CATEGORY_WEIGHTS[key]),
    0
  );
  const score = Math.round(rawScore);

  const hasFailures = failures.length > 0 || allResults.some((r) => r.status === "FAIL");
  const status = hasFailures ? "FAIL" : warnings.length > 0 ? "WARN" : "PASS";

  return {
    jobId: job.id,
    status,
    score,
    checkedAt: new Date().toISOString(),
    video,
    audio,
    captions,
    visuals,
    sync,
    metadata,
    content,
    license,
    warnings,
    failures,
  };
}

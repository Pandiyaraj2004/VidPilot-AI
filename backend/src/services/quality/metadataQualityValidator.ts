/**
 * Metadata completeness (Phase 9) — the fields Phase 11's YouTube upload
 * will need. Checked here, not there, so a gap surfaces long before
 * publish time.
 */

import type { QualityCheckResult, QualityIssue, VideoJob } from "../../types/index.js";

export function validateMetadataQuality(job: VideoJob): QualityCheckResult {
  const issues: QualityIssue[] = [];
  const content = job.content;

  if (!content) {
    return { status: "FAIL", details: {}, issues: [{ severity: "critical", message: "Job has no generated content at all." }] };
  }

  if (!content.title.trim()) issues.push({ severity: "error", message: "Missing video title." });
  if (!content.description.trim()) issues.push({ severity: "error", message: "Missing video description." });
  if (!content.tags || content.tags.length === 0) issues.push({ severity: "warn", message: "No tags generated." });
  if (!job.language.trim()) issues.push({ severity: "error", message: "Missing language." });
  if (!job.contentCategory) issues.push({ severity: "error", message: "Missing content category." });
  if (!content.scenes || content.scenes.length === 0) {
    issues.push({ severity: "critical", message: "Job has no scenes." });
  } else {
    for (const scene of content.scenes) {
      if (!scene.narration.trim()) {
        issues.push({ severity: "error", sceneId: scene.id, message: "Scene has empty narration." });
      }
    }
  }

  const hasCritical = issues.some((i) => i.severity === "critical");
  const hasError = issues.some((i) => i.severity === "error");
  const status = hasCritical || hasError ? "FAIL" : issues.length > 0 ? "WARN" : "PASS";

  return {
    status,
    details: {
      hasTitle: Boolean(content.title?.trim()),
      hasDescription: Boolean(content.description?.trim()),
      tagCount: content.tags?.length ?? 0,
      sceneCount: content.scenes?.length ?? 0,
    },
    issues,
  };
}

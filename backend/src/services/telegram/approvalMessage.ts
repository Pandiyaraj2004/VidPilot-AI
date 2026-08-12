/**
 * Human-readable Telegram approval caption (Phase 10) — a short summary,
 * never the full QC JSON report (that stays in the app). Pure function so
 * it's testable without a real job/Telegram call.
 */

import { CONTENT_CATEGORY_LABELS } from "../audio/contentCategory.js";
import { getVoiceById } from "../voice/voiceConfig.js";
import type { VideoJob } from "../../types/index.js";

function hasRealMusic(job: VideoJob): boolean {
  return Boolean(job.content?.scenes.some((s) => s.audio?.musicTrack));
}

function hasLicensedVisuals(job: VideoJob): { used: boolean; allLicensed: boolean } {
  const assets = job.content?.scenes.flatMap((s) => s.visual?.assets ?? []) ?? [];
  const realAssets = assets.filter((a) => a.provider !== "procedural");
  if (realAssets.length === 0) return { used: false, allLicensed: true };
  return { used: true, allLicensed: realAssets.every((a) => Boolean(a.license?.trim())) };
}

export function buildApprovalCaption(job: VideoJob): string {
  const title = job.content?.title ?? job.topic;
  const category = CONTENT_CATEGORY_LABELS[job.contentCategory] ?? job.contentCategory;
  const duration = job.videoRender?.durationSeconds ?? job.durationSeconds;
  const resolution = job.videoRender ? `${job.videoRender.width}×${job.videoRender.height}` : "unknown";
  const sceneCount = job.content?.scenes.length ?? 0;
  const voiceLabel = getVoiceById(job.voiceId)?.label ?? job.voiceId;
  const music = hasRealMusic(job) ? "✓" : "—";
  const visuals = hasLicensedVisuals(job);
  const visualsLine = !visuals.used ? "Local/Procedural" : visuals.allLicensed ? "Licensed" : "⚠️ Missing license info";

  const qc = job.qualityReport;
  const qcLine = qc ? `${qc.status === "PASS" ? "✓" : "⚠️"} ${qc.status} — ${qc.score}/100` : "not run";

  return [
    "🎬 VidPilot — Video Ready for Approval",
    "",
    "Title:",
    title,
    "",
    "Category:",
    category,
    "",
    "Language:",
    job.language,
    "",
    "Duration:",
    `${duration.toFixed(1)} seconds`,
    "",
    "Format:",
    resolution,
    "",
    "QC:",
    qcLine,
    "",
    "Scenes:",
    String(sceneCount),
    "",
    "Voice:",
    voiceLabel,
    "",
    "Music:",
    music,
    "",
    "Visual Sources:",
    visualsLine,
  ].join("\n");
}

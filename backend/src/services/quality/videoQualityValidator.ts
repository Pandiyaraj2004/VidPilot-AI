/**
 * Technical video quality (Phase 9). Deliberately does NOT re-run
 * videoValidator.ts's full check (including its blackdetect decode pass)
 * — that already ran once, honestly, before the job was ever allowed to
 * reach VIDEO_READY, and its real ffprobe-derived metadata is already
 * stored on job.videoRender. Re-decoding the whole file again here would
 * be the exact "unnecessary repeated decoding" the spec warns against.
 * QC's job is to confirm the file *still* matches that record (catches a
 * file moved/corrupted/truncated after the fact) and to surface it in the
 * QC report's shape — not to duplicate work already done correctly.
 */

import { stat } from "node:fs/promises";
import { config } from "../../config/env.js";
import { runFfprobe } from "../ffmpeg/ffmpegRunner.js";
import type { QualityCheckResult, QualityIssue, VideoRenderMetadata } from "../../types/index.js";

interface ProbeResult {
  streams: { codec_type: string; codec_name: string }[];
  format: { duration?: string };
}

export async function validateVideoQuality(videoRender: VideoRenderMetadata | null): Promise<QualityCheckResult> {
  const issues: QualityIssue[] = [];

  if (!videoRender || videoRender.status !== "ready" || !videoRender.path) {
    return {
      status: "FAIL",
      details: {},
      issues: [{ severity: "critical", message: "No rendered video is recorded for this job." }],
    };
  }

  let fileStat;
  try {
    fileStat = await stat(videoRender.path);
  } catch {
    return {
      status: "FAIL",
      details: { path: videoRender.path },
      issues: [{ severity: "critical", message: "The recorded video file no longer exists or is not readable on disk." }],
    };
  }
  if (fileStat.size === 0) {
    return {
      status: "FAIL",
      details: { path: videoRender.path, fileSizeBytes: 0 },
      issues: [{ severity: "critical", message: "The video file exists but is empty." }],
    };
  }

  // Cheap re-probe (metadata only, no frame decode) to catch a file that
  // exists but can no longer actually be opened — a real, if rare, way a
  // "successful" render can silently rot (partial disk write, truncation).
  let probe: ProbeResult;
  try {
    const stdout = await runFfprobe(["-v", "error", "-print_format", "json", "-show_streams", "-show_format", videoRender.path]);
    probe = JSON.parse(stdout) as ProbeResult;
  } catch (err) {
    return {
      status: "FAIL",
      details: { path: videoRender.path },
      issues: [{ severity: "critical", message: `The video file could not be probed/decoded: ${err instanceof Error ? err.message : String(err)}` }],
    };
  }

  const hasVideoStream = probe.streams.some((s) => s.codec_type === "video");
  const hasAudioStream = probe.streams.some((s) => s.codec_type === "audio");
  if (!hasVideoStream) issues.push({ severity: "critical", message: "The video file has no video stream." });
  if (!hasAudioStream) issues.push({ severity: "critical", message: "The video file has no audio stream." });

  const currentDuration = Number(probe.format.duration ?? 0);
  if (!currentDuration || currentDuration <= 0) {
    issues.push({ severity: "critical", message: "The video file's duration is zero or unreadable." });
  }

  // Compare against the already-real values recorded at render time —
  // both are real ffprobe measurements, so any drift means the file
  // changed since it was validated, not that the earlier check was wrong.
  if (videoRender.durationSeconds != null && currentDuration > 0) {
    const drift = Math.abs(currentDuration - videoRender.durationSeconds);
    if (drift > 1) {
      issues.push({
        severity: "error",
        message: `The video file's current duration (${currentDuration.toFixed(2)}s) no longer matches its recorded duration (${videoRender.durationSeconds.toFixed(2)}s) — the file may have been modified after rendering.`,
      });
    }
  }

  const expectedWidth = config.rendering.width;
  const expectedHeight = config.rendering.height;
  if (videoRender.width !== expectedWidth || videoRender.height !== expectedHeight) {
    issues.push({
      severity: "warn",
      message: `Recorded resolution ${videoRender.width}x${videoRender.height} does not match this deployment's current configured resolution ${expectedWidth}x${expectedHeight} (config may have changed since this job rendered).`,
    });
  }
  if (videoRender.videoCodec !== "h264") {
    issues.push({ severity: "error", message: `Video codec is "${videoRender.videoCodec}", expected h264.` });
  }
  if (videoRender.audioCodec !== "aac") {
    issues.push({ severity: "error", message: `Audio codec is "${videoRender.audioCodec}", expected aac.` });
  }

  const hasCritical = issues.some((i) => i.severity === "critical");
  const hasError = issues.some((i) => i.severity === "error");
  const status = hasCritical || hasError ? "FAIL" : issues.length > 0 ? "WARN" : "PASS";

  return {
    status,
    details: {
      path: videoRender.path,
      resolution: `${videoRender.width}x${videoRender.height}`,
      durationSeconds: currentDuration || videoRender.durationSeconds,
      videoCodec: videoRender.videoCodec,
      audioCodec: videoRender.audioCodec,
      fps: videoRender.fps,
      fileSizeBytes: fileStat.size,
    },
    issues,
  };
}

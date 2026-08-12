/**
 * Audio quality (Phase 9) — real ffmpeg analysis of the FINAL rendered
 * video's own audio track, never the per-scene intermediate WAVs. The
 * final muxed track is what a viewer actually hears, so it's the only
 * honest source of truth here (mirrors Phase 6's own "the final audio
 * file is the source of truth" rule, extended to the whole video).
 *
 * Deliberately narrower than a full loudness-standards check: `astats`
 * gives real dBFS peak/RMS, not true integrated LUFS (that needs
 * `loudnorm`'s two-pass analysis), so thresholds here are dBFS bands wide
 * enough to be honest about that imprecision rather than pretending
 * broadcast-standard accuracy this pipeline doesn't have.
 *
 * Known limitation, stated rather than hidden: once narration, music, and
 * SFX are mixed into one track, there is no way to independently re-verify
 * "is narration louder than music" from the final file alone — that would
 * need the separate stems, which this pipeline doesn't retain past
 * mixing. This validator checks what the final track genuinely allows:
 * overall presence, clipping, and excessive silence.
 */

import { runFfmpegWithStderr } from "../ffmpeg/ffmpegRunner.js";
import type { QualityCheckResult, QualityIssue } from "../../types/index.js";

// Same silence-gap philosophy as voice/audioValidator.ts's
// DEFAULT_MAX_INTERNAL_SILENCE_SECONDS — reused here rather than inventing
// a second number for the same real-world concept (an unexplained dead-air
// gap), just applied to the whole mixed track instead of one clip.
const SILENCE_NOISE_FLOOR_DB = "-35dB";
const SILENCE_MIN_GAP_SECONDS = 1.0;
const SEVERE_SILENCE_GAP_SECONDS = 3.0;

// A real, cleanly-mixed track has real headroom below full scale (the
// Science-category sample this threshold was tuned against peaks at
// -9.19 dB) — a peak sitting within a hair of 0 dBFS means the mix was
// driven into the ceiling. Deliberately NOT using astats' "Peak count"
// field as an extra "sustained, not one stray sample" gate the way
// voice/audioValidator.ts's hand-parsed-PCM clip check does (its
// CLIP_MIN_RUN_SAMPLES): verified against real ffmpeg output that "Peak
// count" tracks how many times the signal touches its own global peak
// value, not how many samples sit at/near full scale — it stays at 1-2
// even for a heavily overdriven track, so it doesn't actually measure
// "sustained." Peak level alone is what's honestly measurable here.
const CLIPPING_PEAK_DB_THRESHOLD = -0.3;

// Near-total silence across the whole track means no narration was
// actually captured in the mix — a real, objective floor, not a guess.
const NO_NARRATION_RMS_DB_THRESHOLD = -50;
// Below this, playback is unreasonably quiet even accounting for dBFS-vs-
// LUFS imprecision; above the upper bound, the mix is uncomfortably hot.
const QUIET_RMS_DB_THRESHOLD = -40;
const LOUD_RMS_DB_THRESHOLD = -6;

function parseAstats(stderr: string): { peakDb: number | null; rmsDb: number | null } {
  const peak = stderr.match(/Peak level dB:\s*(-?[\d.]+|-?inf)/i);
  const rms = stderr.match(/RMS level dB:\s*(-?[\d.]+|-?inf)/i);
  const toNumber = (m: RegExpMatchArray | null): number | null => {
    if (!m) return null;
    if (m[1].toLowerCase() === "-inf") return -Infinity;
    return Number(m[1]);
  };
  return { peakDb: toNumber(peak), rmsDb: toNumber(rms) };
}

function parseSilenceGaps(stderr: string): number[] {
  const gaps: number[] = [];
  const matches = stderr.matchAll(/silence_duration:\s*([\d.]+)/g);
  for (const m of matches) gaps.push(Number(m[1]));
  return gaps;
}

export async function validateAudioQuality(videoPath: string | null): Promise<QualityCheckResult> {
  if (!videoPath) {
    return { status: "FAIL", details: {}, issues: [{ severity: "critical", message: "No video file to analyze audio from." }] };
  }

  let stderr: string;
  try {
    const result = await runFfmpegWithStderr([
      "-i", videoPath,
      "-af", `astats=metadata=0:reset=0,silencedetect=noise=${SILENCE_NOISE_FLOOR_DB}:d=${SILENCE_MIN_GAP_SECONDS}`,
      "-f", "null", "-",
    ]);
    stderr = result.stderr;
  } catch (err) {
    return {
      status: "FAIL",
      details: {},
      issues: [{ severity: "critical", message: `Audio analysis failed: ${err instanceof Error ? err.message : String(err)}` }],
    };
  }

  const { peakDb, rmsDb } = parseAstats(stderr);
  const silenceGaps = parseSilenceGaps(stderr);
  const longestGap = silenceGaps.length > 0 ? Math.max(...silenceGaps) : 0;
  const issues: QualityIssue[] = [];

  if (rmsDb === null) {
    issues.push({ severity: "critical", message: "Could not measure any audio level — the audio stream may be missing or corrupt." });
  } else if (rmsDb <= NO_NARRATION_RMS_DB_THRESHOLD) {
    issues.push({ severity: "critical", message: `The audio track is essentially silent (RMS ${rmsDb.toFixed(1)} dB) — narration was not captured in the final mix.` });
  } else {
    if (rmsDb < QUIET_RMS_DB_THRESHOLD) {
      issues.push({ severity: "warn", message: `Overall audio level is quiet (RMS ${rmsDb.toFixed(1)} dB) — may be hard to hear on some devices.` });
    } else if (rmsDb > LOUD_RMS_DB_THRESHOLD) {
      issues.push({ severity: "warn", message: `Overall audio level is very hot (RMS ${rmsDb.toFixed(1)} dB) — check for distortion.` });
    }
  }

  if (peakDb !== null && peakDb > CLIPPING_PEAK_DB_THRESHOLD) {
    issues.push({
      severity: "error",
      message: `Audio peak (${peakDb.toFixed(2)} dB) is at or above full scale — the mix was driven into clipping.`,
    });
  }

  if (longestGap >= SEVERE_SILENCE_GAP_SECONDS) {
    issues.push({ severity: "error", message: `A ${longestGap.toFixed(1)}s silent gap was found in the audio — likely dead air, not a natural pause.` });
  } else if (longestGap >= SILENCE_MIN_GAP_SECONDS) {
    issues.push({ severity: "warn", message: `A ${longestGap.toFixed(1)}s silent gap was found in the audio.` });
  }

  const hasCritical = issues.some((i) => i.severity === "critical");
  const hasError = issues.some((i) => i.severity === "error");
  const status = hasCritical || hasError ? "FAIL" : issues.length > 0 ? "WARN" : "PASS";

  return {
    status,
    details: {
      peakDb,
      rmsDb,
      longestSilenceGapSeconds: longestGap,
      silenceGapCount: silenceGaps.length,
    },
    issues,
  };
}

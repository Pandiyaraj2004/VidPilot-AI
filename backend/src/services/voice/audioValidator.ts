import { readFile, stat } from "node:fs/promises";
import { parseWavMetadata, type AudioMetadata } from "./audioMetadata.js";

export interface AudioValidationResult {
  valid: boolean;
  errors: string[];
  metadata?: AudioMetadata;
}

export interface AudioValidationOptions {
  /**
   * Phase 6 — longest stretch of near-silence anywhere in the file that's
   * still considered normal pacing rather than a defect. A single
   * provider-generated sentence clip has no legitimate reason to contain a
   * long internal gap, so callers validating one (piperProvider.ts,
   * edgeTtsProvider.ts) can rely on the tight default. The final,
   * multi-sentence assembled scene file genuinely contains deliberate
   * pauses (see voiceDirectionSystem.ts) up to ~1.3s, so voiceEngine.ts
   * passes a threshold derived from the actual pause plan it just built —
   * never a fixed guess that would flag a real dramatic pause as broken.
   */
  maxInternalSilenceSeconds?: number;
}

const MIN_DURATION_SECONDS = 0.1;
// Out of a max possible 32767 for 16-bit PCM — roughly 0.6% amplitude. Real
// speech sits far above this; this only catches genuinely empty/silent output.
const SILENCE_RMS_THRESHOLD = 200;
const DEFAULT_MAX_INTERNAL_SILENCE_SECONDS = 1.0;
// A sample is "clipped" once it's within this margin of full-scale (32767).
const CLIP_SAMPLE_THRESHOLD = 32760;
// Require a sustained run, not one stray peak sample, before calling it clipping.
const CLIP_MIN_RUN_SAMPLES = 12;
// Window size for the internal-silence scan — fine enough to localize a gap, coarse enough to be cheap.
const SILENCE_WINDOW_SECONDS = 0.05;
// Skip this much at each edge — leading/trailing silence is normal and handled separately (trimSilence).
const SILENCE_EDGE_SKIP_SECONDS = 0.2;

/**
 * Everything Piper/Edge TTS (or the Phase 6 assembly pipeline) could
 * plausibly get wrong, checked in order: does the file exist, is it
 * non-empty, does it have a valid WAV header, is its duration real, is it
 * actually silent, does it clip, and does it contain an unexplained long
 * internal gap. Any failure here means VOICE_FAILED, never a saved-but-
 * broken scene.
 */
export async function validateAudioFile(
  filePath: string,
  options: AudioValidationOptions = {}
): Promise<AudioValidationResult> {
  let stats;
  try {
    stats = await stat(filePath);
  } catch {
    return { valid: false, errors: ["Audio file does not exist."] };
  }

  if (!stats.isFile() || stats.size === 0) {
    return { valid: false, errors: ["Audio file is empty."] };
  }

  let buffer: Buffer;
  try {
    buffer = await readFile(filePath);
  } catch {
    return { valid: false, errors: ["Audio file could not be read."] };
  }

  let metadata: AudioMetadata;
  try {
    metadata = parseWavMetadata(buffer);
  } catch (err) {
    return { valid: false, errors: [(err as Error).message] };
  }

  const errors: string[] = [];

  if (metadata.durationSeconds < MIN_DURATION_SECONDS) {
    errors.push("Audio duration is effectively zero.");
  }

  if (isSilent(buffer, metadata)) {
    errors.push("Generated audio appears to be silent.");
  }

  if (metadata.bitsPerSample === 16) {
    const dataChunk = findDataChunk(buffer);
    if (dataChunk) {
      if (hasClipping(buffer, dataChunk)) {
        errors.push("Generated audio shows signs of clipping (sustained samples pinned at full scale).");
      }

      const maxAllowed = options.maxInternalSilenceSeconds ?? DEFAULT_MAX_INTERNAL_SILENCE_SECONDS;
      const longestGap = longestInternalSilenceSeconds(buffer, dataChunk, metadata.sampleRate);
      if (longestGap > maxAllowed) {
        errors.push(
          `Audio contains an unexplained ${longestGap.toFixed(2)}s silent gap, longer than the ${maxAllowed.toFixed(2)}s expected for this clip.`
        );
      }
    }
  }

  return { valid: errors.length === 0, errors, metadata };
}

/** True when a sustained run of samples is pinned at (near) full scale — a single stray peak sample is normal audio, not clipping. */
function hasClipping(buffer: Buffer, dataChunk: { offset: number; size: number }): boolean {
  const sampleCount = Math.floor(dataChunk.size / 2);
  let run = 0;
  for (let i = 0; i < sampleCount; i++) {
    const sample = Math.abs(buffer.readInt16LE(dataChunk.offset + i * 2));
    if (sample >= CLIP_SAMPLE_THRESHOLD) {
      run += 1;
      if (run >= CLIP_MIN_RUN_SAMPLES) return true;
    } else {
      run = 0;
    }
  }
  return false;
}

/** Longest stretch of near-silent windows strictly inside the file, excluding the very start/end (leading/trailing silence is normal and handled separately by trimSilence). */
function longestInternalSilenceSeconds(buffer: Buffer, dataChunk: { offset: number; size: number }, sampleRate: number): number {
  const totalSamples = Math.floor(dataChunk.size / 2);
  const windowSamples = Math.max(1, Math.round(SILENCE_WINDOW_SECONDS * sampleRate));
  const edgeSamples = Math.round(SILENCE_EDGE_SKIP_SECONDS * sampleRate);
  const start = Math.min(edgeSamples, totalSamples);
  const end = Math.max(start, totalSamples - edgeSamples);

  let longestRunWindows = 0;
  let currentRunWindows = 0;

  for (let pos = start; pos < end; pos += windowSamples) {
    const windowEnd = Math.min(pos + windowSamples, end);
    let sumSquares = 0;
    let counted = 0;
    for (let i = pos; i < windowEnd; i++) {
      const sample = buffer.readInt16LE(dataChunk.offset + i * 2);
      sumSquares += sample * sample;
      counted += 1;
    }
    const rms = counted > 0 ? Math.sqrt(sumSquares / counted) : 0;
    if (rms < SILENCE_RMS_THRESHOLD) {
      currentRunWindows += 1;
      longestRunWindows = Math.max(longestRunWindows, currentRunWindows);
    } else {
      currentRunWindows = 0;
    }
  }

  return longestRunWindows * SILENCE_WINDOW_SECONDS;
}

function isSilent(buffer: Buffer, metadata: AudioMetadata): boolean {
  // Only implemented for 16-bit PCM (what Piper produces) — don't flag other
  // depths as silent just because we haven't taught this function to read them.
  if (metadata.bitsPerSample !== 16) return false;

  const dataChunk = findDataChunk(buffer);
  if (!dataChunk || dataChunk.size < 2) return true;

  const sampleCount = Math.floor(dataChunk.size / 2);
  // Stride through samples rather than reading every one — plenty accurate
  // for a silence check and much cheaper on long files.
  const stride = Math.max(1, Math.floor(sampleCount / 20000));
  let sumSquares = 0;
  let counted = 0;
  for (let i = 0; i < sampleCount; i += stride) {
    const sample = buffer.readInt16LE(dataChunk.offset + i * 2);
    sumSquares += sample * sample;
    counted += 1;
  }
  const rms = Math.sqrt(sumSquares / counted);
  return rms < SILENCE_RMS_THRESHOLD;
}

function findDataChunk(buffer: Buffer): { offset: number; size: number } | null {
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    if (chunkId === "data") {
      return { offset: chunkStart, size: Math.min(chunkSize, buffer.length - chunkStart) };
    }
    offset = chunkStart + chunkSize + (chunkSize % 2);
  }
  return null;
}

/**
 * Real ffmpeg audio processing for the Phase 6 expressive audio engine:
 * trims per-sentence clips, splices them back together with deliberate
 * silence gaps (see voiceDirectionSystem.ts), and runs one final loudness
 * normalization + gentle limiting + fade pass. Every step is a real ffmpeg
 * filter — nothing here estimates or fakes an audio property.
 */

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { runFfmpeg } from "../ffmpeg/ffmpegRunner.js";
import { readAudioMetadata } from "./audioMetadata.js";

/** Trims leading AND trailing silence via the reverse-trim-reverse trick — avoids needing to know the file's duration up front. */
export async function trimSilence(inputPath: string, outputPath: string): Promise<void> {
  const filter =
    "silenceremove=start_periods=1:start_duration=0:start_threshold=-45dB:detection=peak," +
    "areverse," +
    "silenceremove=start_periods=1:start_duration=0:start_threshold=-45dB:detection=peak," +
    "areverse";
  await runFfmpeg(["-y", "-i", inputPath, "-af", filter, outputPath]);
}

/** Generates a real silent PCM WAV clip matching the given format — used as an explicit pause between sentences, never a decoder artifact. */
export async function generateSilenceClip(
  durationSeconds: number,
  sampleRate: number,
  channels: number,
  outputPath: string
): Promise<void> {
  const channelLayout = channels === 1 ? "mono" : "stereo";
  await runFfmpeg([
    "-y",
    "-f", "lavfi",
    "-i", `anullsrc=r=${sampleRate}:cl=${channelLayout}`,
    "-t", durationSeconds.toFixed(3),
    "-ar", String(sampleRate),
    "-ac", String(channels),
    "-sample_fmt", "s16",
    outputPath,
  ]);
}

function concatListLine(filePath: string): string {
  const escaped = filePath.replace(/'/g, "'\\''");
  return `file '${escaped}'`;
}

/** Stream-copy concatenation — every input must share sample rate/channels/format, which callers here guarantee (all sentence clips + generated silences use the same format; see assembleSceneAudio). */
async function concatAudioClips(clipPaths: string[], outputPath: string): Promise<void> {
  const listDir = await mkdtemp(path.join(tmpdir(), "vidpilot-audio-concat-"));
  const listFile = path.join(listDir, "list.txt");
  try {
    const listContent = clipPaths.map((p) => concatListLine(path.resolve(p))).join("\n");
    await writeFile(listFile, listContent, "utf-8");
    await runFfmpeg(["-y", "-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", outputPath]);
  } finally {
    await rm(listDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/**
 * Final pass on the fully-assembled scene audio: EBU R128 loudness
 * normalization, gentle peak limiting, and a short fade in/out. The
 * fade-out uses the same reverse trick as trimSilence so no upfront
 * duration lookup is needed.
 */
export async function normalizeAndFade(inputPath: string, outputPath: string): Promise<void> {
  const filter =
    "loudnorm=I=-16:TP=-1.5:LRA=11," +
    "alimiter=limit=0.95:attack=5:release=50," +
    "afade=t=in:st=0:d=0.05," +
    "areverse,afade=t=in:st=0:d=0.05,areverse";
  await runFfmpeg(["-y", "-i", inputPath, "-af", filter, "-sample_fmt", "s16", outputPath]);
}

/**
 * Assembles a scene's final audio from per-sentence clips: trims each
 * clip's own silence, splices in a deliberate pause (possibly zero-length)
 * after each one except the last, concatenates, then runs the final
 * normalize/limit/fade pass. `pauseSecondsBetween[i]` is the gap placed
 * after sentence clip `i` (length must be `clips.length - 1`).
 */
export async function assembleSceneAudio(
  sentenceClipPaths: string[],
  pauseSecondsBetween: number[],
  outputPath: string
): Promise<void> {
  if (sentenceClipPaths.length === 0) {
    throw new Error("assembleSceneAudio requires at least one sentence clip.");
  }
  if (pauseSecondsBetween.length !== sentenceClipPaths.length - 1) {
    throw new Error("pauseSecondsBetween must have exactly one entry per gap between clips.");
  }

  const workDir = await mkdtemp(path.join(tmpdir(), "vidpilot-audio-assemble-"));
  try {
    const firstMeta = await readAudioMetadata(sentenceClipPaths[0]);

    const trimmedPaths: string[] = [];
    for (let i = 0; i < sentenceClipPaths.length; i++) {
      const trimmed = path.join(workDir, `trimmed-${i}.wav`);
      await trimSilence(sentenceClipPaths[i], trimmed);
      trimmedPaths.push(trimmed);
    }

    const sequence: string[] = [];
    for (let i = 0; i < trimmedPaths.length; i++) {
      sequence.push(trimmedPaths[i]);
      const gapSeconds = pauseSecondsBetween[i];
      if (gapSeconds > 0) {
        const silencePath = path.join(workDir, `silence-${i}.wav`);
        await generateSilenceClip(gapSeconds, firstMeta.sampleRate, firstMeta.channels, silencePath);
        sequence.push(silencePath);
      }
    }

    const concatenated = path.join(workDir, "concatenated.wav");
    await concatAudioClips(sequence, concatenated);
    await normalizeAndFade(concatenated, outputPath);
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

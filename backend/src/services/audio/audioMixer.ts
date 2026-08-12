/**
 * Mixes narration with optional background music (+ optional SFX) into one
 * final scene audio file. Remotion's composition doesn't change at all —
 * it already just plays whatever `scene.audio.path` points to (see
 * remotionRenderer.ts's <Audio src=...>), so music/SFX have to be baked
 * into that same file here, before rendering ever runs.
 *
 * Ducking is attempted for real via ffmpeg's sidechaincompress (music
 * genuinely dips under narration and recovers in gaps) with a fixed-
 * attenuation fallback if that filter graph fails on a given input —
 * both paths are real audio processing, neither is a fake claim.
 */

import { copyFile, rm } from "node:fs/promises";
import { runFfmpeg } from "../ffmpeg/ffmpegRunner.js";
import { readAudioMetadata } from "../voice/audioMetadata.js";
import { config } from "../../config/env.js";

export interface SfxPlacement {
  path: string;
  offsetSeconds: number;
}

export interface MixSceneAudioInput {
  narrationPath: string;
  musicPath?: string;
  sfx?: SfxPlacement[];
  outputPath: string;
}

/** Builds the [1:a]...[music_pre] chain: loop the track to cover the full narration duration (works whether the source is shorter or longer), fade its edges, hold it under musicVolume before ducking is applied on top. */
function musicPrepFilter(durationSeconds: number): string {
  const fadeSeconds = Math.min(1, durationSeconds / 4);
  const fadeOutStart = Math.max(0, durationSeconds - fadeSeconds).toFixed(3);
  return (
    `[1:a]aloop=loop=-1:size=2000000000,atrim=0:${durationSeconds.toFixed(3)},` +
    `volume=${config.music.musicVolume},` +
    `afade=t=in:st=0:d=${fadeSeconds.toFixed(3)},afade=t=out:st=${fadeOutStart}:d=${fadeSeconds.toFixed(3)}[music_pre]`
  );
}

async function mixWithSidechainDucking(
  narrationPath: string,
  musicPath: string,
  durationSeconds: number,
  sampleRate: number,
  channels: number,
  outputPath: string
): Promise<void> {
  const filterComplex = [
    musicPrepFilter(durationSeconds),
    // sidechaincompress's inputs are [main][sidechain] — main is the signal that
    // actually gets compressed and appears in the output; the sidechain input is
    // only a control signal and is otherwise discarded. Music must be main
    // (so its real audio survives into music_ducked) with narration as the
    // sidechain (so music dips when narration is loud) — swapped, this
    // silently drops the music track entirely and outputs a compressed copy
    // of the narration instead.
    "[music_pre][0:a]sidechaincompress=threshold=0.05:ratio=8:attack=20:release=300[music_ducked]",
    "[0:a][music_ducked]amix=inputs=2:duration=first:dropout_transition=0,dynaudnorm[out]",
  ].join(";");

  await runFfmpeg([
    "-y",
    "-i", narrationPath,
    "-i", musicPath,
    "-filter_complex", filterComplex,
    "-map", "[out]",
    "-t", durationSeconds.toFixed(3),
    "-ar", String(sampleRate),
    "-ac", String(channels),
    "-sample_fmt", "s16",
    outputPath,
  ]);
}

/** Fallback when the sidechain graph fails on some input: music held at a fixed, lower level under narration — real static attenuation, not dynamic ducking, and reported as such by the caller. */
async function mixWithFixedAttenuation(
  narrationPath: string,
  musicPath: string,
  durationSeconds: number,
  sampleRate: number,
  channels: number,
  outputPath: string
): Promise<void> {
  const quieterMusic = `${musicPrepFilter(durationSeconds).replace(
    `volume=${config.music.musicVolume}`,
    `volume=${(config.music.musicVolume * 0.5).toFixed(3)}`
  )}`;
  const filterComplex = [quieterMusic, "[0:a][music_pre]amix=inputs=2:duration=first:dropout_transition=0[out]"].join(";");

  await runFfmpeg([
    "-y",
    "-i", narrationPath,
    "-i", musicPath,
    "-filter_complex", filterComplex,
    "-map", "[out]",
    "-t", durationSeconds.toFixed(3),
    "-ar", String(sampleRate),
    "-ac", String(channels),
    "-sample_fmt", "s16",
    outputPath,
  ]);
}

async function overlaySfx(basePath: string, sfx: SfxPlacement[], sampleRate: number, channels: number, outputPath: string): Promise<void> {
  const inputs: string[] = ["-i", basePath];
  const delayedLabels: string[] = [];
  sfx.forEach((s, i) => {
    inputs.push("-i", s.path);
    const delayMs = Math.max(0, Math.round(s.offsetSeconds * 1000));
    delayedLabels.push(`[${i + 1}:a]adelay=${delayMs}|${delayMs},volume=${config.music.sfxVolume}[sfx${i}]`);
  });
  const mixInputs = ["[0:a]", ...delayedLabels.map((_, i) => `[sfx${i}]`)].join("");
  const filterComplex = [...delayedLabels, `${mixInputs}amix=inputs=${sfx.length + 1}:duration=first:dropout_transition=0[out]`].join(";");

  await runFfmpeg([
    "-y",
    ...inputs,
    "-filter_complex", filterComplex,
    "-map", "[out]",
    "-ar", String(sampleRate),
    "-ac", String(channels),
    "-sample_fmt", "s16",
    outputPath,
  ]);
}

/** Returns whether real dynamic ducking was used, or the fallback, or no music at all — so the caller can record honest metadata rather than assuming. */
export interface MixSceneAudioResult {
  usedMusic: boolean;
  usedDynamicDucking: boolean;
  usedSfxCount: number;
}

export async function mixSceneAudio(input: MixSceneAudioInput): Promise<MixSceneAudioResult> {
  const hasSfx = Boolean(input.sfx && input.sfx.length > 0);

  if (!input.musicPath && !hasSfx) {
    await copyFile(input.narrationPath, input.outputPath);
    return { usedMusic: false, usedDynamicDucking: false, usedSfxCount: 0 };
  }

  const narrationMeta = await readAudioMetadata(input.narrationPath);
  let usedDynamicDucking = false;
  let musicMixedPath = input.narrationPath;

  if (input.musicPath) {
    try {
      await mixWithSidechainDucking(
        input.narrationPath,
        input.musicPath,
        narrationMeta.durationSeconds,
        narrationMeta.sampleRate,
        narrationMeta.channels,
        hasSfx ? `${input.outputPath}.music-tmp.wav` : input.outputPath
      );
      usedDynamicDucking = true;
    } catch (err) {
      console.error(`[VidPilot] Sidechain ducking failed, falling back to fixed attenuation: ${(err as Error).message}`);
      await mixWithFixedAttenuation(
        input.narrationPath,
        input.musicPath,
        narrationMeta.durationSeconds,
        narrationMeta.sampleRate,
        narrationMeta.channels,
        hasSfx ? `${input.outputPath}.music-tmp.wav` : input.outputPath
      );
    }
    musicMixedPath = hasSfx ? `${input.outputPath}.music-tmp.wav` : input.outputPath;
  }

  if (hasSfx) {
    await overlaySfx(musicMixedPath, input.sfx!, narrationMeta.sampleRate, narrationMeta.channels, input.outputPath);
    if (musicMixedPath !== input.narrationPath) {
      await rm(musicMixedPath, { force: true }).catch(() => undefined);
    }
  }

  return { usedMusic: Boolean(input.musicPath), usedDynamicDucking, usedSfxCount: input.sfx?.length ?? 0 };
}

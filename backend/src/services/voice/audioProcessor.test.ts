import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runFfmpeg } from "../ffmpeg/ffmpegRunner.js";
import { readAudioMetadata } from "./audioMetadata.js";
import { assembleSceneAudio, generateSilenceClip, normalizeAndFade, trimSilence } from "./audioProcessor.js";

/** Real ffmpeg-synthesized tone padded with real silence — exercises the actual filters under test, not a mock. */
async function makeToneWithSilencePadding(outputPath: string, toneSeconds: number, silenceSeconds: number, sampleRate = 22050): Promise<void> {
  await runFfmpeg([
    "-y",
    "-f", "lavfi", "-t", String(silenceSeconds), "-i", `anullsrc=r=${sampleRate}:cl=mono`,
    "-f", "lavfi", "-t", String(toneSeconds), "-i", `sine=frequency=440:sample_rate=${sampleRate}`,
    "-f", "lavfi", "-t", String(silenceSeconds), "-i", `anullsrc=r=${sampleRate}:cl=mono`,
    "-filter_complex", "[0:a][1:a][2:a]concat=n=3:v=0:a=1[out]",
    "-map", "[out]",
    "-ar", String(sampleRate), "-ac", "1", "-sample_fmt", "s16",
    outputPath,
  ]);
}

async function makeTone(outputPath: string, seconds: number, sampleRate = 22050): Promise<void> {
  await runFfmpeg([
    "-y", "-f", "lavfi", "-i", `sine=frequency=440:sample_rate=${sampleRate}`,
    "-t", String(seconds), "-ar", String(sampleRate), "-ac", "1", "-sample_fmt", "s16",
    outputPath,
  ]);
}

describe("audioProcessor (real ffmpeg)", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "vidpilot-audio-processor-test-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("trimSilence measurably shortens a tone padded with real leading/trailing silence", async () => {
    const input = path.join(dir, "padded.wav");
    const output = path.join(dir, "trimmed.wav");
    await makeToneWithSilencePadding(input, 1.0, 1.0); // 1s silence + 1s tone + 1s silence = ~3s

    const before = await readAudioMetadata(input);
    await trimSilence(input, output);
    const after = await readAudioMetadata(output);

    expect(before.durationSeconds).toBeGreaterThan(2.5);
    expect(after.durationSeconds).toBeLessThan(before.durationSeconds - 1.0);
    expect(after.durationSeconds).toBeGreaterThan(0.5); // the real tone content survives
  });

  it("generateSilenceClip produces a real silent WAV of the requested duration and format", async () => {
    const output = path.join(dir, "silence.wav");
    await generateSilenceClip(0.5, 24000, 1, output);
    const meta = await readAudioMetadata(output);
    expect(meta.durationSeconds).toBeCloseTo(0.5, 1);
    expect(meta.sampleRate).toBe(24000);
    expect(meta.channels).toBe(1);
  });

  it("normalizeAndFade preserves real audio content and roughly preserves duration", async () => {
    const input = path.join(dir, "tone.wav");
    const output = path.join(dir, "normalized.wav");
    await makeTone(input, 2.0);

    const before = await readAudioMetadata(input);
    await normalizeAndFade(input, output);
    const after = await readAudioMetadata(output);

    expect(after.durationSeconds).toBeCloseTo(before.durationSeconds, 0);
  });

  it("assembleSceneAudio concatenates real sentence clips with real, deliberate silence gaps", async () => {
    const clip0 = path.join(dir, "s0.wav");
    const clip1 = path.join(dir, "s1.wav");
    const clip2 = path.join(dir, "s2.wav");
    await Promise.all([makeTone(clip0, 1.0), makeTone(clip1, 1.0), makeTone(clip2, 1.0)]);

    const output = path.join(dir, "assembled.wav");
    const gapSeconds = [0.5, 1.0]; // between clip0-1 and clip1-2
    await assembleSceneAudio([clip0, clip1, clip2], gapSeconds, output);

    const meta = await readAudioMetadata(output);
    // 3 clips (~1s each, though trimSilence may shave a few ms of true silence at each edge) + explicit gaps.
    expect(meta.durationSeconds).toBeGreaterThan(1.0 * 3 + 0.5 + 1.0 - 0.3);
    expect(meta.durationSeconds).toBeLessThan(1.0 * 3 + 0.5 + 1.0 + 0.3);
  });

  it("assembleSceneAudio rejects a mismatched gap-count argument", async () => {
    const clip0 = path.join(dir, "s0.wav");
    await makeTone(clip0, 1.0);
    await expect(assembleSceneAudio([clip0], [0.5], path.join(dir, "out.wav"))).rejects.toThrow();
  });
});

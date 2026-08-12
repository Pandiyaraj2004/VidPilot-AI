import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runFfmpeg } from "../ffmpeg/ffmpegRunner.js";
import { validateAudioQuality } from "./audioQualityValidator.js";

async function makeAudioVideo(
  outputPath: string,
  audioFilterGraph: string,
  durationSeconds = 3
): Promise<void> {
  await runFfmpeg([
    "-y",
    "-f", "lavfi", "-i", `color=c=black:size=320x240:rate=10:duration=${durationSeconds}`,
    "-f", "lavfi", "-i", `sine=frequency=440:sample_rate=44100:duration=${durationSeconds}`,
    "-filter_complex", `[1:a]${audioFilterGraph}[a]`,
    "-map", "0:v", "-map", "[a]",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest",
    outputPath,
  ]);
}

describe("validateAudioQuality (real ffmpeg)", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "vidpilot-qc-audio-test-"));
  });

  afterEach(() => {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // best-effort — see sceneTransitionConcat.test.ts's note on Windows handle timing
    }
  });

  it("fails critically when there is no video path to analyze", async () => {
    const result = await validateAudioQuality(null);
    expect(result.status).toBe("FAIL");
  });

  it("passes a real audio track at a normal, healthy level", async () => {
    const file = path.join(dir, "normal.mp4");
    await makeAudioVideo(file, "volume=0.3");
    const result = await validateAudioQuality(file);
    expect(result.status).toBe("PASS");
  });

  it("fails critically when the audio track is essentially silent throughout", async () => {
    const file = path.join(dir, "silent.mp4");
    await runFfmpeg([
      "-y",
      "-f", "lavfi", "-i", "color=c=black:size=320x240:rate=10:duration=3",
      "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono",
      "-map", "0:v", "-map", "1:a",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest",
      file,
    ]);
    const result = await validateAudioQuality(file);
    expect(result.status).toBe("FAIL");
    expect(result.issues.some((i) => i.severity === "critical")).toBe(true);
  });

  it("flags sustained clipping on a deliberately overdriven track", async () => {
    const file = path.join(dir, "clipped.mp4");
    // Gain pushed far past 0dBFS — the encoder hard-clips the waveform at
    // full scale for a large fraction of every cycle, a real sustained
    // clip, not one stray sample.
    await makeAudioVideo(file, "volume=15");
    const result = await validateAudioQuality(file);
    expect(result.status).toBe("FAIL");
    expect(result.issues.some((i) => i.message.includes("clipping"))).toBe(true);
  });

  it("warns on a real silent gap in the middle of otherwise-present audio", async () => {
    const file = path.join(dir, "gap.mp4");
    await runFfmpeg([
      "-y",
      "-f", "lavfi", "-i", "color=c=black:size=320x240:rate=10:duration=5",
      "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100:duration=1.5",
      "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono:duration=2",
      "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100:duration=1.5",
      "-filter_complex", "[1:a][2:a][3:a]concat=n=3:v=0:a=1[a]",
      "-map", "0:v", "-map", "[a]",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest",
      file,
    ]);
    const result = await validateAudioQuality(file);
    expect(["WARN", "FAIL"]).toContain(result.status);
    expect(result.issues.some((i) => i.message.includes("silent gap"))).toBe(true);
  });
});

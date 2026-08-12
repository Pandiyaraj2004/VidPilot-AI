import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runFfmpeg } from "../ffmpeg/ffmpegRunner.js";
import { makeTestVideo } from "../video/testFixtures.js";
import { AssetDownloadError, probeMedia } from "./assetDownloader.js";

/** Exercises the real ffprobe binary against real fixture files — no mocking of the validation step, since that's exactly the logic under test. */
describe("probeMedia — real ffprobe validation", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "vidpilot-asset-probe-test-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("accepts a real, valid video and reports its true dimensions/duration", async () => {
    const videoPath = path.join(dir, "real.mp4");
    await makeTestVideo(videoPath, { width: 640, height: 360, durationSeconds: 2 });

    const result = await probeMedia(videoPath, "video");
    expect(result.width).toBe(640);
    expect(result.height).toBe(360);
    expect(result.durationSeconds).not.toBeNull();
    expect(result.durationSeconds!).toBeGreaterThan(1);
  });

  it("accepts a real, valid still image and reports its true dimensions", async () => {
    const imagePath = path.join(dir, "real.jpg");
    await runFfmpeg(["-y", "-f", "lavfi", "-i", "testsrc=size=320x240", "-frames:v", "1", imagePath], 30000);

    const result = await probeMedia(imagePath, "image");
    expect(result.width).toBe(320);
    expect(result.height).toBe(240);
    expect(result.durationSeconds).toBeNull();
  });

  it("rejects a truncated/corrupt file rather than trusting the extension", async () => {
    const fakePath = path.join(dir, "fake.mp4");
    writeFileSync(fakePath, "this is not a real video file, just text with an .mp4 name");

    await expect(probeMedia(fakePath, "video")).rejects.toThrow(AssetDownloadError);
  });

  it("rejects an empty file", async () => {
    const emptyPath = path.join(dir, "empty.jpg");
    writeFileSync(emptyPath, "");

    await expect(probeMedia(emptyPath, "image")).rejects.toThrow(AssetDownloadError);
  });
});

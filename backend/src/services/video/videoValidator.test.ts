import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeTestVideo as makeVideo } from "./testFixtures.js";
import { validateVideoFile } from "./videoValidator.js";

describe("validateVideoFile", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "vidpilot-video-test-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("passes for a real H.264/AAC file at the expected resolution and duration", async () => {
    const file = path.join(dir, "valid.mp4");
    // Matches config.rendering.width/height's default (vertical Shorts) — see config/env.ts.
    await makeVideo(file, { durationSeconds: 2, width: 1080, height: 1920 });

    const result = await validateVideoFile(file, 2);
    expect(result.valid).toBe(true);
    expect(result.metadata?.width).toBe(1080);
    expect(result.metadata?.height).toBe(1920);
    expect(result.metadata?.videoCodec).toBe("h264");
    expect(result.metadata?.audioCodec).toBe("aac");
    expect(result.metadata?.durationSeconds).toBeCloseTo(2, 0);
  }, 30000);

  it("fails for a file that does not exist", async () => {
    const result = await validateVideoFile(path.join(dir, "missing.mp4"), 5);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/does not exist/);
  });

  it("fails for an empty file", async () => {
    const file = path.join(dir, "empty.mp4");
    writeFileSync(file, Buffer.alloc(0));
    const result = await validateVideoFile(file, 5);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/empty/);
  });

  it("fails when the resolution does not match the expected output size", async () => {
    const file = path.join(dir, "wrong-resolution.mp4");
    await makeVideo(file, { width: 640, height: 360, durationSeconds: 1 });

    const result = await validateVideoFile(file, 1);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Resolution"))).toBe(true);
  }, 30000);

  it("fails when there is no audio stream", async () => {
    const file = path.join(dir, "no-audio.mp4");
    await makeVideo(file, { durationSeconds: 1, withAudio: false });

    const result = await validateVideoFile(file, 1);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("audio stream"))).toBe(true);
  }, 30000);

  it("fails when the duration does not match the real narration audio duration", async () => {
    const file = path.join(dir, "short.mp4");
    await makeVideo(file, { durationSeconds: 1 });

    const result = await validateVideoFile(file, 30);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("duration"))).toBe(true);
  }, 30000);

  it("fails for a video that is almost entirely black", async () => {
    const file = path.join(dir, "black.mp4");
    await makeVideo(file, { durationSeconds: 2, black: true });

    const result = await validateVideoFile(file, 2);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.toLowerCase().includes("black"))).toBe(true);
  }, 30000);
});

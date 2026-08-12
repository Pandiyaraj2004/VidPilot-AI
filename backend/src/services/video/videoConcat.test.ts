import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeTestVideo } from "./testFixtures.js";
import { concatSceneVideos } from "./videoConcat.js";
import { validateVideoFile } from "./videoValidator.js";

describe("concatSceneVideos", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "vidpilot-concat-test-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("joins multiple scene videos into one file with the combined duration", async () => {
    const sceneA = path.join(dir, "scene-a.mp4");
    const sceneB = path.join(dir, "scene-b.mp4");
    const sceneC = path.join(dir, "scene-c.mp4");
    // Matches config.rendering.width/height's default (vertical Shorts) — see config/env.ts.
    await Promise.all([
      makeTestVideo(sceneA, { durationSeconds: 1, width: 1080, height: 1920 }),
      makeTestVideo(sceneB, { durationSeconds: 2, width: 1080, height: 1920 }),
      makeTestVideo(sceneC, { durationSeconds: 1, width: 1080, height: 1920 }),
    ]);

    const output = path.join(dir, "final.mp4");
    await concatSceneVideos([sceneA, sceneB, sceneC], output);

    const result = await validateVideoFile(output, 4);
    expect(result.valid).toBe(true);
    expect(result.metadata?.durationSeconds).toBeCloseTo(4, 0);
  }, 30000);

  it("throws when given no scene videos", async () => {
    await expect(concatSceneVideos([], path.join(dir, "final.mp4"))).rejects.toThrow();
  });
});

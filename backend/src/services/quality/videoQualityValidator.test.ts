import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeTestVideo } from "../video/testFixtures.js";
import { validateVideoQuality } from "./videoQualityValidator.js";
import { config } from "../../config/env.js";
import type { VideoRenderMetadata } from "../../types/index.js";

// Matches this deployment's actual configured resolution, since
// validateVideoQuality intentionally re-checks against *current* config
// (to catch a render whose config has since changed) rather than only the
// value recorded at render time.
const W = config.rendering.width;
const H = config.rendering.height;

function makeRenderRecord(overrides: Partial<VideoRenderMetadata> = {}): VideoRenderMetadata {
  return {
    status: "ready",
    generatedAt: new Date(0).toISOString(),
    durationSeconds: 2,
    width: W,
    height: H,
    fps: 30,
    videoCodec: "h264",
    audioCodec: "aac",
    fileSizeBytes: 1000,
    path: "",
    error: null,
    ...overrides,
  };
}

describe("validateVideoQuality (real ffprobe)", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "vidpilot-qc-video-test-"));
  });

  afterEach(() => {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // best-effort — see sceneTransitionConcat.test.ts for the same Windows handle-timing note
    }
  });

  it("fails critically when there is no render record at all", async () => {
    const result = await validateVideoQuality(null);
    expect(result.status).toBe("FAIL");
    expect(result.issues[0].severity).toBe("critical");
  });

  it("fails critically when the recorded path no longer exists on disk", async () => {
    const result = await validateVideoQuality(makeRenderRecord({ path: path.join(dir, "does-not-exist.mp4") }));
    expect(result.status).toBe("FAIL");
  });

  it("passes a real, valid H.264/AAC file matching its own recorded metadata", async () => {
    const file = path.join(dir, "video.mp4");
    await makeTestVideo(file, { width: W, height: H, durationSeconds: 2 });
    const result = await validateVideoQuality(makeRenderRecord({ path: file }));
    expect(result.status).toBe("PASS");
  });

  it("flags an error when the file's current duration no longer matches its recorded duration", async () => {
    const file = path.join(dir, "video.mp4");
    await makeTestVideo(file, { width: W, height: H, durationSeconds: 5 });
    const result = await validateVideoQuality(makeRenderRecord({ path: file, durationSeconds: 2 }));
    expect(result.status).toBe("FAIL");
  });

  it("fails when the file has no audio stream", async () => {
    const file = path.join(dir, "video.mp4");
    await makeTestVideo(file, { width: W, height: H, durationSeconds: 2, withAudio: false });
    const result = await validateVideoQuality(makeRenderRecord({ path: file }));
    expect(result.status).toBe("FAIL");
    expect(result.issues.some((i) => i.message.includes("audio stream"))).toBe(true);
  });

  it("fails on an empty file", async () => {
    const file = path.join(dir, "empty.mp4");
    await import("node:fs/promises").then((fs) => fs.writeFile(file, ""));
    const result = await validateVideoQuality(makeRenderRecord({ path: file }));
    expect(result.status).toBe("FAIL");
  });
});

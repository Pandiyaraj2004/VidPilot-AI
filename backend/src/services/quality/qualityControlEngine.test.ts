import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runFfmpeg } from "../ffmpeg/ffmpegRunner.js";
import { config } from "../../config/env.js";
import { runQualityControl } from "./qualityControlEngine.js";
import type { VideoJob, VideoScene } from "../../types/index.js";

const W = config.rendering.width;
const H = config.rendering.height;

/**
 * testFixtures.ts's makeTestVideo defaults to real digital silence
 * (anullsrc) for its audio track — correct for tests that don't care about
 * audio content, but the QC engine's own new audio validator correctly
 * flags real silence as a critical defect. A "this job is genuinely fine"
 * fixture needs real (non-silent) audio content instead.
 */
async function makeHealthyTestVideo(outputPath: string, durationSeconds: number): Promise<void> {
  await runFfmpeg([
    "-y",
    "-f", "lavfi", "-i", `color=c=blue:size=${W}x${H}:rate=30:duration=${durationSeconds}`,
    "-f", "lavfi", "-i", `sine=frequency=440:sample_rate=44100:duration=${durationSeconds}`,
    "-af", "volume=0.3",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest",
    outputPath,
  ]);
}

function makeScene(overrides: Partial<VideoScene> = {}): VideoScene {
  return {
    id: "scene-1",
    order: 0,
    narration: "The ocean covers most of the planet.",
    visualDescription: "an aerial ocean shot",
    onScreenText: "The Ocean",
    estimatedDuration: 3,
    audio: { status: "ready", duration: 3 },
    visual: { status: "ready", segments: [{ id: "seg-0", startTime: 0, endTime: 3, mediaKind: "color", backgroundKind: "gradient", colors: ["#111", "#222"], accentColor: "#facc15", cameraMotion: "zoom_in", transition: "cut", contentType: "none" }] },
    subtitles: [{ index: 0, text: "The ocean covers most of the planet.", startSeconds: 0, endSeconds: 3 }],
    highlightWords: ["ocean"],
    ...overrides,
  };
}

function makeJob(videoPath: string, overrides: Partial<VideoJob> = {}): VideoJob {
  return {
    id: "job-1",
    topic: "The ocean",
    inputScript: null,
    style: "explainer",
    contentCategory: "general_knowledge",
    durationSeconds: 3,
    language: "en",
    voiceId: "en_US-amy-medium",
    voiceSpeed: 1,
    visualStyle: "automatic",
    subtitlesEnabled: true,
    thumbnailEnabled: false,
    approvalRequired: false,
    youtubeVisibility: "private",
    status: "video_ready",
    content: {
      title: "How Much of the Ocean Have We Explored?",
      hook: "hook",
      introduction: "intro",
      scenes: [makeScene()],
      conclusion: "conclusion",
      description: "A real description.",
      tags: ["ocean", "science"],
      estimatedDuration: 3,
    },
    scriptProvider: "gemini",
    scriptModel: "gemini-2.5-flash",
    scriptGeneratedAt: new Date(0).toISOString(),
    voiceGeneration: null,
    renderTemplate: null,
    videoRender: {
      status: "ready",
      generatedAt: new Date(0).toISOString(),
      durationSeconds: 3,
      width: W,
      height: H,
      fps: 30,
      videoCodec: "h264",
      audioCodec: "aac",
      fileSizeBytes: 1000,
      path: videoPath,
      error: null,
    },
    qualityReport: null,
    renderVersion: 0,
    approval: null,
    thumbnail: null,
    youtube: null,
    lastError: null,
    retryCount: 0,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    approvedAt: null,
    publishedAt: null,
    youtubeVideoId: null,
    telegramMessageId: null,
    ...overrides,
  };
}

describe("runQualityControl (real ffmpeg + real job data)", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "vidpilot-qc-engine-test-"));
  });

  afterEach(() => {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // best-effort — see sceneTransitionConcat.test.ts's note on Windows handle timing
    }
  });

  it("PASSes a fully valid job with a real, healthy video/audio file", async () => {
    const file = path.join(dir, "video.mp4");
    await makeHealthyTestVideo(file, 3);
    const report = await runQualityControl(makeJob(file));
    expect(report.status).toBe("PASS");
    expect(report.score).toBe(100);
    expect(report.failures).toHaveLength(0);
  });

  it("a CRITICAL issue forces overall FAIL even though every other category is fine", async () => {
    const job = makeJob(""); // no video render path at all -> video validator returns a critical issue
    job.videoRender = null;
    const report = await runQualityControl(job);
    expect(report.status).toBe("FAIL");
  });

  it("a non-critical WARN in one category still allows overall WARN, not FAIL", async () => {
    const file = path.join(dir, "video.mp4");
    await makeHealthyTestVideo(file, 3);
    const job = makeJob(file);
    job.content!.tags = []; // metadata WARN only
    const report = await runQualityControl(job);
    expect(report.status).toBe("WARN");
    expect(report.score).toBeLessThan(100);
    expect(report.score).toBeGreaterThan(90);
  });

  it("a single category FAIL (not just an issue) forces overall FAIL regardless of score", async () => {
    const file = path.join(dir, "video.mp4");
    await makeHealthyTestVideo(file, 3);
    const job = makeJob(file);
    job.content!.scenes[0].subtitles = []; // captions category FAILs outright
    const report = await runQualityControl(job);
    expect(report.status).toBe("FAIL");
    expect(report.captions.status).toBe("FAIL");
  });

  it("warnings and failures are correctly bucketed by severity across categories", async () => {
    const file = path.join(dir, "video.mp4");
    await makeHealthyTestVideo(file, 3);
    const job = makeJob(file);
    job.content!.tags = []; // warn
    job.content!.scenes[0].highlightWords = ["nonexistentword"]; // warn
    const report = await runQualityControl(job);
    expect(report.failures).toHaveLength(0);
    expect(report.warnings.length).toBeGreaterThanOrEqual(2);
  });
});

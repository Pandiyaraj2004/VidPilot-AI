import { describe, it, expect } from "vitest";
import { validateSyncQuality } from "./syncQualityValidator.js";
import type { VideoJob, VideoScene } from "../../types/index.js";

function makeScene(overrides: Partial<VideoScene> = {}): VideoScene {
  return {
    id: "scene-1",
    order: 0,
    narration: "n",
    visualDescription: "",
    onScreenText: "",
    estimatedDuration: 5,
    audio: { status: "ready", duration: 5 },
    visual: { status: "ready", segments: [{ id: "seg-0", startTime: 0, endTime: 5, mediaKind: "color", backgroundKind: "gradient", colors: ["#111", "#222"], accentColor: "#facc15", cameraMotion: "zoom_in", transition: "cut", contentType: "none" }] },
    subtitles: [{ index: 0, text: "n", startSeconds: 0, endSeconds: 5 }],
    ...overrides,
  };
}

function makeJob(scenes: VideoScene[], finalDuration: number | null): VideoJob {
  const sum = scenes.reduce((a, s) => a + (s.audio?.duration ?? 0), 0);
  return {
    id: "job-1",
    topic: "t",
    inputScript: null,
    style: "explainer",
    contentCategory: "general_knowledge",
    durationSeconds: 30,
    language: "en",
    voiceId: "en_US-amy-medium",
    voiceSpeed: 1,
    visualStyle: "automatic",
    subtitlesEnabled: true,
    thumbnailEnabled: false,
    approvalRequired: false,
    youtubeVisibility: "private",
    status: "video_ready",
    content: { title: "t", hook: "h", introduction: "i", scenes, conclusion: "c", description: "d", tags: [], estimatedDuration: sum },
    scriptProvider: "gemini",
    scriptModel: "gemini-2.5-flash",
    scriptGeneratedAt: new Date(0).toISOString(),
    voiceGeneration: null,
    renderTemplate: null,
    videoRender: finalDuration == null ? null : { status: "ready", generatedAt: new Date(0).toISOString(), durationSeconds: finalDuration, width: 1080, height: 1920, fps: 30, videoCodec: "h264", audioCodec: "aac", fileSizeBytes: 1000, path: "/x.mp4", error: null },
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
  };
}

describe("validateSyncQuality", () => {
  it("passes a well-aligned single-scene job", () => {
    const job = makeJob([makeScene()], 5);
    expect(validateSyncQuality(job).status).toBe("PASS");
  });

  it("passes a multi-scene job whose final duration is slightly shorter due to real transitions", () => {
    const scenes = [makeScene({ id: "s1" }), makeScene({ id: "s2" }), makeScene({ id: "s3" })];
    // 3 scenes x 5s = 15s naive sum; 2 boundaries, each transition <=0.8s -> up to 1.6s shrink is explainable.
    const job = makeJob(scenes, 14.3);
    expect(validateSyncQuality(job).status).toBe("PASS");
  });

  it("fails when the final video is drastically shorter than scene audio can explain (missing scene)", () => {
    const scenes = [makeScene({ id: "s1" }), makeScene({ id: "s2" }), makeScene({ id: "s3" })];
    const job = makeJob(scenes, 8); // 15s of narration but an 8s video
    expect(validateSyncQuality(job).status).toBe("FAIL");
  });

  it("fails when the final video is longer than the sum of scene audio", () => {
    const job = makeJob([makeScene()], 20);
    expect(validateSyncQuality(job).status).toBe("FAIL");
  });

  it("fails when a scene's visual timeline ends before its narration does", () => {
    const scene = makeScene({
      visual: { status: "ready", segments: [{ id: "seg-0", startTime: 0, endTime: 2, mediaKind: "color", backgroundKind: "gradient", colors: ["#111", "#222"], accentColor: "#facc15", cameraMotion: "zoom_in", transition: "cut", contentType: "none" }] },
    });
    const job = makeJob([scene], 5);
    expect(validateSyncQuality(job).status).toBe("FAIL");
  });

  it("fails when a scene's last caption ends after its narration finishes", () => {
    const scene = makeScene({ subtitles: [{ index: 0, text: "n", startSeconds: 0, endSeconds: 8 }] });
    const job = makeJob([scene], 5);
    expect(validateSyncQuality(job).status).toBe("FAIL");
  });

  it("fails critically when a scene has no measured audio duration", () => {
    const scene = makeScene({ audio: { status: "generating" } });
    const job = makeJob([scene], null);
    const result = validateSyncQuality(job);
    expect(result.status).toBe("FAIL");
    expect(result.issues.some((i) => i.severity === "critical")).toBe(true);
  });
});

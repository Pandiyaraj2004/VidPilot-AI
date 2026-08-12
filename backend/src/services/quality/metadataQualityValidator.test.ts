import { describe, it, expect } from "vitest";
import { validateMetadataQuality } from "./metadataQualityValidator.js";
import type { VideoJob } from "../../types/index.js";

function makeJob(overrides: Partial<VideoJob> = {}): VideoJob {
  return {
    id: "job-1",
    topic: "test",
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
    content: {
      title: "A Real Title",
      hook: "hook",
      introduction: "intro",
      scenes: [{ id: "s1", order: 0, narration: "Real narration text.", visualDescription: "", onScreenText: "", estimatedDuration: 5 }],
      conclusion: "conclusion",
      description: "A real description.",
      tags: ["tag1", "tag2"],
      estimatedDuration: 30,
    },
    scriptProvider: "gemini",
    scriptModel: "gemini-2.5-flash",
    scriptGeneratedAt: new Date(0).toISOString(),
    voiceGeneration: null,
    renderTemplate: null,
    videoRender: null,
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

describe("validateMetadataQuality", () => {
  it("passes complete metadata", () => {
    expect(validateMetadataQuality(makeJob()).status).toBe("PASS");
  });

  it("fails when the job has no generated content", () => {
    const result = validateMetadataQuality(makeJob({ content: null }));
    expect(result.status).toBe("FAIL");
    expect(result.issues[0].severity).toBe("critical");
  });

  it("fails on a missing title", () => {
    const job = makeJob();
    job.content!.title = "";
    expect(validateMetadataQuality(job).status).toBe("FAIL");
  });

  it("fails on a missing description", () => {
    const job = makeJob();
    job.content!.description = "  ";
    expect(validateMetadataQuality(job).status).toBe("FAIL");
  });

  it("warns (not fails) on missing tags", () => {
    const job = makeJob();
    job.content!.tags = [];
    expect(validateMetadataQuality(job).status).toBe("WARN");
  });

  it("fails when a scene has empty narration", () => {
    const job = makeJob();
    job.content!.scenes[0].narration = "   ";
    expect(validateMetadataQuality(job).status).toBe("FAIL");
  });

  it("fails critically when there are no scenes at all", () => {
    const job = makeJob();
    job.content!.scenes = [];
    const result = validateMetadataQuality(job);
    expect(result.status).toBe("FAIL");
    expect(result.issues.some((i) => i.severity === "critical")).toBe(true);
  });
});

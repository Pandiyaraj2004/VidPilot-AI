import { describe, it, expect } from "vitest";
import { validateLicenseQuality } from "./licenseQualityValidator.js";
import type { VideoJob, VisualAssetMetadata } from "../../types/index.js";

function makeAsset(overrides: Partial<VisualAssetMetadata> = {}): VisualAssetMetadata {
  return {
    id: "asset-1",
    provider: "pixabay",
    mediaType: "video",
    sourcePageUrl: "https://pixabay.com/x",
    author: "someone",
    license: "Pixabay License",
    attributionRequired: false,
    attributionText: null,
    query: "ocean",
    width: 1920,
    height: 1080,
    durationSeconds: 5,
    downloadedAt: new Date(0).toISOString(),
    fileSizeBytes: 1000,
    ...overrides,
  };
}

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
      title: "t",
      hook: "h",
      introduction: "i",
      scenes: [{ id: "s1", order: 0, narration: "n", visualDescription: "", onScreenText: "", estimatedDuration: 5 }],
      conclusion: "c",
      description: "d",
      tags: [],
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

describe("validateLicenseQuality", () => {
  it("passes when every asset has a real license", () => {
    const job = makeJob();
    job.content!.scenes[0].visual = { status: "ready", assets: [makeAsset()] };
    expect(validateLicenseQuality(job).status).toBe("PASS");
  });

  it("fails when an asset has no license recorded", () => {
    const job = makeJob();
    job.content!.scenes[0].visual = { status: "ready", assets: [makeAsset({ license: "" })] };
    expect(validateLicenseQuality(job).status).toBe("FAIL");
  });

  it("fails when attribution is required but no attribution text is recorded", () => {
    const job = makeJob();
    job.content!.scenes[0].visual = { status: "ready", assets: [makeAsset({ attributionRequired: true, attributionText: null })] };
    expect(validateLicenseQuality(job).status).toBe("FAIL");
  });

  it("skips procedural assets — nothing to attribute", () => {
    const job = makeJob();
    job.content!.scenes[0].visual = { status: "ready", assets: [makeAsset({ provider: "procedural", license: "" })] };
    expect(validateLicenseQuality(job).status).toBe("PASS");
  });

  it("fails when background music has no recorded license", () => {
    const job = makeJob();
    job.content!.scenes[0].audio = { status: "ready", duration: 5, musicTrack: "Some Track", musicLicense: "" };
    expect(validateLicenseQuality(job).status).toBe("FAIL");
  });

  it("fails when music requires attribution but has none", () => {
    const job = makeJob();
    job.content!.scenes[0].audio = {
      status: "ready",
      duration: 5,
      musicTrack: "Some Track",
      musicLicense: "CC BY",
      musicAttributionRequired: true,
      musicAttributionText: null,
    };
    expect(validateLicenseQuality(job).status).toBe("FAIL");
  });

  it("passes a job with no external assets or music at all", () => {
    expect(validateLicenseQuality(makeJob()).status).toBe("PASS");
  });
});

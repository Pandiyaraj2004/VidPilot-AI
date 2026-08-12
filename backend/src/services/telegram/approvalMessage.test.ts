import { describe, expect, it } from "vitest";
import { buildApprovalCaption } from "./approvalMessage.js";
import type { VideoJob, VisualAssetMetadata } from "../../types/index.js";

function makeJob(overrides: Partial<VideoJob> = {}): VideoJob {
  return {
    id: "job-1",
    topic: "The history of the printing press",
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
    approvalRequired: true,
    youtubeVisibility: "private",
    status: "ready",
    content: {
      title: "How the Printing Press Changed Everything",
      hook: "hook",
      introduction: "intro",
      scenes: [
        { id: "s1", order: 0, narration: "Real narration text.", visualDescription: "", onScreenText: "", estimatedDuration: 15 },
        { id: "s2", order: 1, narration: "More narration.", visualDescription: "", onScreenText: "", estimatedDuration: 15 },
      ],
      conclusion: "conclusion",
      description: "A real description.",
      tags: ["history", "printing"],
      estimatedDuration: 30,
    },
    scriptProvider: "gemini",
    scriptModel: "gemini-2.5-flash",
    scriptGeneratedAt: new Date(0).toISOString(),
    voiceGeneration: null,
    renderTemplate: "documentary",
    videoRender: {
      status: "ready",
      generatedAt: new Date(0).toISOString(),
      durationSeconds: 30.4,
      width: 1080,
      height: 1920,
      fps: 30,
      videoCodec: "h264",
      audioCodec: "aac",
      fileSizeBytes: 5_000_000,
      path: "/fake/final.mp4",
      error: null,
    },
    qualityReport: null,
    renderVersion: 1,
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

function makeAsset(overrides: Partial<VisualAssetMetadata> = {}): VisualAssetMetadata {
  return {
    id: "asset-1",
    provider: "pixabay",
    mediaType: "video",
    sourcePageUrl: "https://pixabay.com/videos/1",
    author: "someone",
    license: "Pixabay License",
    attributionRequired: false,
    attributionText: null,
    query: "printing press",
    width: 1920,
    height: 1080,
    durationSeconds: 10,
    downloadedAt: new Date(0).toISOString(),
    fileSizeBytes: 100000,
    ...overrides,
  };
}

describe("buildApprovalCaption", () => {
  it("includes the title, category, language, duration, and resolution", () => {
    const caption = buildApprovalCaption(makeJob());
    expect(caption).toContain("How the Printing Press Changed Everything");
    expect(caption).toContain("30.4 seconds");
    expect(caption).toContain("1080×1920");
    expect(caption).toContain("en");
  });

  it("falls back to the raw topic when there's no generated content title", () => {
    const caption = buildApprovalCaption(makeJob({ content: null }));
    expect(caption).toContain("The history of the printing press");
  });

  it("shows a real QC score line when a quality report exists", () => {
    const caption = buildApprovalCaption(
      makeJob({
        qualityReport: {
          jobId: "job-1",
          status: "WARN",
          score: 94,
          checkedAt: new Date(0).toISOString(),
          video: { status: "PASS", details: {}, issues: [] },
          audio: { status: "PASS", details: {}, issues: [] },
          captions: { status: "PASS", details: {}, issues: [] },
          visuals: { status: "PASS", details: {}, issues: [] },
          sync: { status: "PASS", details: {}, issues: [] },
          metadata: { status: "PASS", details: {}, issues: [] },
          content: { status: "WARN", details: {}, issues: [] },
          license: { status: "PASS", details: {}, issues: [] },
          warnings: [{ severity: "warn", message: "minor issue" }],
          failures: [],
        },
      })
    );
    expect(caption).toContain("WARN — 94/100");
  });

  it("reports 'not run' when no quality report exists yet", () => {
    expect(buildApprovalCaption(makeJob())).toContain("not run");
  });

  it("reports scene count from the real content", () => {
    expect(buildApprovalCaption(makeJob())).toContain("Scenes:\n2");
  });

  it("marks music present when any scene has a musicTrack", () => {
    const job = makeJob();
    job.content!.scenes[0].audio = {
      status: "ready",
      duration: 5,
      format: "wav",
      provider: "piper",
      musicTrack: "Some Real Track Title",
    };
    expect(buildApprovalCaption(job)).toContain("Music:\n✓");
  });

  it("reports 'Local/Procedural' when no real visual assets were used", () => {
    expect(buildApprovalCaption(makeJob())).toContain("Local/Procedural");
  });

  it("reports 'Licensed' when every real visual asset has a license", () => {
    const job = makeJob();
    job.content!.scenes[0].visual = { status: "ready", assets: [makeAsset()] };
    expect(buildApprovalCaption(job)).toContain("Visual Sources:\nLicensed");
  });

  it("flags missing license info instead of silently calling it licensed", () => {
    const job = makeJob();
    job.content!.scenes[0].visual = { status: "ready", assets: [makeAsset({ license: "" })] };
    expect(buildApprovalCaption(job)).toContain("Missing license info");
  });
});

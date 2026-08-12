import { describe, expect, it } from "vitest";
import { planThumbnail } from "./thumbnailPlanner.js";
import type { VideoJob, VisualAssetMetadata } from "../../types/index.js";

function makeJob(overrides: Partial<VideoJob> = {}): VideoJob {
  return {
    id: "job-1",
    topic: "Surprising facts about octopuses",
    inputScript: null,
    style: "explainer",
    contentCategory: "general_knowledge",
    durationSeconds: 30,
    language: "en",
    voiceId: "en_US-amy-medium",
    voiceSpeed: 1,
    visualStyle: "automatic",
    subtitlesEnabled: true,
    thumbnailEnabled: true,
    approvalRequired: true,
    youtubeVisibility: "private",
    status: "approved",
    content: {
      title: "The Alien Minds of the Deep: Surprising Octopus Intelligence",
      hook: "Imagine an animal with brains in its arms. Sounds like science fiction, right?",
      introduction: "intro",
      scenes: [
        {
          id: "s1",
          order: 0,
          narration: "Octopuses have three hearts.",
          visualDescription: "",
          onScreenText: "",
          estimatedDuration: 10,
          emotion: "surprise",
          highlightWords: ["3 hearts"],
        },
      ],
      conclusion: "conclusion",
      description: "desc",
      tags: ["octopus"],
      estimatedDuration: 30,
    },
    scriptProvider: "gemini",
    scriptModel: "gemini-2.5-flash",
    scriptGeneratedAt: new Date(0).toISOString(),
    voiceGeneration: null,
    renderTemplate: "explainer",
    videoRender: null,
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
    query: "octopus",
    width: 1920,
    height: 1080,
    durationSeconds: 10,
    downloadedAt: new Date(0).toISOString(),
    fileSizeBytes: 100000,
    ...overrides,
  };
}

describe("planThumbnail", () => {
  it("prefers a short AI highlight phrase for the headline, uppercased with emotion-appropriate punctuation", () => {
    const plan = planThumbnail(makeJob());
    expect(plan.headline).toBe("3 HEARTS?");
  });

  it("falls back to the hook's first clause when there's no short highlight phrase", () => {
    const job = makeJob();
    job.content!.scenes[0].highlightWords = undefined;
    job.content!.hook = "Never give up, no matter what.";
    job.content!.scenes[0].emotion = "motivation";
    const plan = planThumbnail(job);
    expect(plan.headline).toBe("NEVER GIVE UP!");
  });

  it("falls back to a truncated title when neither highlight words nor a short hook clause are usable", () => {
    const job = makeJob();
    job.content!.scenes[0].highlightWords = undefined;
    job.content!.hook = "This is a very long opening sentence that goes on for quite a while before any punctuation appears at all";
    const plan = planThumbnail(job);
    expect(plan.headline.length).toBeLessThanOrEqual(28);
    expect(plan.headline).toBe(plan.headline.toUpperCase());
  });

  it("never puts the entire long title on the thumbnail", () => {
    const job = makeJob({
      content: {
        ...makeJob().content!,
        title: "This Is An Extremely Long Video Title That Should Never Appear In Full On A Thumbnail",
        hook: "Also a fairly long hook sentence with no early punctuation to split on whatsoever",
        scenes: [{ ...makeJob().content!.scenes[0], highlightWords: undefined }],
      },
    });
    const plan = planThumbnail(job);
    expect(plan.headline.length).toBeLessThanOrEqual(28);
  });

  it("picks the first real visual asset across scenes as the background source", () => {
    const asset = makeAsset();
    const job = makeJob();
    job.content!.scenes[0].visual = { status: "ready", assets: [asset] };
    const plan = planThumbnail(job);
    expect(plan.sourceAsset?.id).toBe("asset-1");
  });

  it("falls back to null (procedural background) when no scene has a real visual asset", () => {
    const plan = planThumbnail(makeJob());
    expect(plan.sourceAsset).toBeNull();
  });

  it("reuses the scene's own real palette when available", () => {
    const job = makeJob();
    job.content!.scenes[0].visual = { status: "ready", colors: ["#111111", "#222222"], accentColor: "#ffffff" };
    const plan = planThumbnail(job);
    expect(plan.colors).toEqual(["#111111", "#222222"]);
    expect(plan.accentColor).toBe("#ffffff");
  });

  it("falls back to a real category-specific palette when the scene has no visual yet", () => {
    const plan = planThumbnail(makeJob({ contentCategory: "mystery" }));
    expect(plan.colors[0]).toBeTruthy();
    expect(plan.accentColor).toBeTruthy();
  });

  it("is fully deterministic — same job in, same plan out", () => {
    const job = makeJob();
    expect(planThumbnail(job)).toEqual(planThumbnail(job));
  });
});

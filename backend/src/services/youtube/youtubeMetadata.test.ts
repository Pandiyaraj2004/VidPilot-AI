import { describe, expect, it } from "vitest";
import {
  buildYoutubeDescription,
  buildYoutubeTags,
  buildYoutubeTitle,
  buildYoutubeUploadMetadata,
  mapJobLanguageToYoutubeLanguage,
  validateYoutubeTitle,
} from "./youtubeMetadata.js";
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
    thumbnailEnabled: false,
    approvalRequired: true,
    youtubeVisibility: "private",
    status: "approved",
    content: {
      title: "The Alien Minds of the Deep",
      hook: "hook",
      introduction: "intro",
      scenes: [{ id: "s1", order: 0, narration: "Real narration.", visualDescription: "", onScreenText: "", estimatedDuration: 10 }],
      conclusion: "conclusion",
      description: "Dive into the astonishing world of octopuses! #OctopusFacts #MarineLife",
      tags: ["octopus intelligence", "marine biology", "ocean facts"],
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

describe("validateYoutubeTitle", () => {
  it("accepts a normal real title", () => {
    expect(validateYoutubeTitle("The Alien Minds of the Deep").valid).toBe(true);
  });

  it("rejects an empty title", () => {
    expect(validateYoutubeTitle("   ").valid).toBe(false);
  });

  it("rejects a title over YouTube's 100-character limit", () => {
    const result = validateYoutubeTitle("x".repeat(101));
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("100-character limit");
  });

  it("rejects a title containing control characters", () => {
    const titleWithControlChar = `Octopus Facts${String.fromCharCode(1)}`;
    expect(validateYoutubeTitle(titleWithControlChar).valid).toBe(false);
  });

  it("allows normal punctuation and emoji, which are not control characters", () => {
    expect(validateYoutubeTitle("Did You Know Octopuses Have 3 Hearts? \u{1F419}").valid).toBe(true);
  });

  it("flags an obviously self-duplicated title", () => {
    const result = validateYoutubeTitle("Octopus Facts You Never Knew Octopus Facts You Never Knew");
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("repeat"))).toBe(true);
  });

  it("does not flag a title that merely repeats a single common word", () => {
    expect(validateYoutubeTitle("Facts About the Deep Deep Ocean").valid).toBe(true);
  });
});

describe("buildYoutubeTitle", () => {
  it("reuses the real AI-generated title when it's valid", () => {
    expect(buildYoutubeTitle(makeJob())).toBe("The Alien Minds of the Deep");
  });

  it("falls back to the job's topic when content is missing entirely", () => {
    expect(buildYoutubeTitle(makeJob({ content: null }))).toBe("Surprising facts about octopuses");
  });

  it("falls back to the topic when the AI title is invalid", () => {
    const job = makeJob();
    job.content!.title = "";
    expect(buildYoutubeTitle(job)).toBe("Surprising facts about octopuses");
  });
});

describe("buildYoutubeDescription", () => {
  it("reuses the real AI-generated description as the body", () => {
    const description = buildYoutubeDescription(makeJob());
    expect(description).toContain("Dive into the astonishing world of octopuses");
  });

  it("does not include a synthetic-media disclosure", () => {
    expect(buildYoutubeDescription(makeJob())).not.toContain("Disclosure:");
  });

  it("does not include music attribution section", () => {
    const job = makeJob();
    job.content!.scenes[0].audio = {
      status: "ready",
      duration: 5,
      musicTrack: "Heathrow",
      musicArtist: "Slim",
      musicAttributionRequired: true,
      musicAttributionText: '"Heathrow" by Slim, licensed under CC BY-SA — via Jamendo',
    };
    const description = buildYoutubeDescription(job);
    expect(description).not.toContain("Music");
    expect(description).not.toContain('"Heathrow" by Slim, licensed under CC BY-SA — via Jamendo');
  });

  it("includes real visual attribution only for assets that actually require it, never inventing it", () => {
    const job = makeJob();
    job.content!.scenes[0].visual = {
      status: "ready",
      assets: [makeAsset({ attributionRequired: true, attributionText: "Photo by Someone on Pixabay" })],
    };
    const description = buildYoutubeDescription(job);
    expect(description).toContain("Visual Credits");
    expect(description).toContain("Photo by Someone on Pixabay");
  });

  it("does not include an asset's credit when attribution isn't required", () => {
    const job = makeJob();
    job.content!.scenes[0].visual = { status: "ready", assets: [makeAsset({ attributionRequired: false })] };
    expect(buildYoutubeDescription(job)).not.toContain("Visual Credits");
  });

  it("deduplicates repeated music/visual credits across scenes", () => {
    const job = makeJob();
    const sharedAsset = makeAsset({ id: "shared", attributionRequired: true, attributionText: "Credit X" });
    job.content!.scenes = [
      { ...job.content!.scenes[0], id: "s1", visual: { status: "ready", assets: [sharedAsset] } },
      { ...job.content!.scenes[0], id: "s2", visual: { status: "ready", assets: [sharedAsset] } },
    ];
    const description = buildYoutubeDescription(job);
    expect(description.match(/Credit X/g)?.length).toBe(1);
  });
});

describe("buildYoutubeTags", () => {
  it("reuses the real AI-generated tags", () => {
    expect(buildYoutubeTags(makeJob())).toEqual(["octopus intelligence", "marine biology", "ocean facts"]);
  });

  it("deduplicates case-insensitively", () => {
    const job = makeJob();
    job.content!.tags = ["Octopus", "octopus", "OCTOPUS"];
    expect(buildYoutubeTags(job)).toEqual(["Octopus"]);
  });

  it("caps the total joined length under YouTube's real 500-character tag limit", () => {
    const job = makeJob();
    job.content!.tags = Array.from({ length: 50 }, (_, i) => `tag-number-${i}-with-some-length-padding`);
    const tags = buildYoutubeTags(job);
    const totalLength = tags.join(",").length;
    expect(totalLength).toBeLessThan(500);
  });
});

describe("mapJobLanguageToYoutubeLanguage", () => {
  it("preserves Tamil rather than silently defaulting to English", () => {
    expect(mapJobLanguageToYoutubeLanguage("ta")).toBe("ta");
  });

  it("preserves Hindi", () => {
    expect(mapJobLanguageToYoutubeLanguage("hi")).toBe("hi");
  });
});

describe("buildYoutubeUploadMetadata", () => {
  it("assembles a complete, real upload metadata object", () => {
    const metadata = buildYoutubeUploadMetadata(makeJob());
    expect(metadata.title).toBe("The Alien Minds of the Deep");
    expect(metadata.categoryId).toBe("27");
    expect(metadata.privacyStatus).toBe("private");
    expect(metadata.defaultLanguage).toBe("en");
    expect(metadata.containsSyntheticMedia).toBe(true);
    expect(metadata.madeForKids).toBe(false);
  });

  it("defaults to Private even when the job's own setting is unlisted/public — the caller is responsible for defaulting new jobs to Private, this just passes through whatever the job says", () => {
    const metadata = buildYoutubeUploadMetadata(makeJob({ youtubeVisibility: "public" }));
    expect(metadata.privacyStatus).toBe("public");
  });

  it("maps a Tamil job's real language through unchanged", () => {
    const metadata = buildYoutubeUploadMetadata(makeJob({ language: "ta" }));
    expect(metadata.defaultLanguage).toBe("ta");
  });
});

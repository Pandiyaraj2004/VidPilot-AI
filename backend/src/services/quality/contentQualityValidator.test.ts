import { describe, it, expect } from "vitest";
import { validateContentQuality, LocalHeuristicProvider } from "./contentQualityValidator.js";
import type { VideoScene, VisualAssetMetadata } from "../../types/index.js";

function makeAsset(query: string, overrides: Partial<VisualAssetMetadata> = {}): VisualAssetMetadata {
  return {
    id: "asset-1",
    provider: "pixabay",
    mediaType: "video",
    sourcePageUrl: "https://pixabay.com/x",
    author: null,
    license: "Pixabay License",
    attributionRequired: false,
    attributionText: null,
    query,
    width: 1920,
    height: 1080,
    durationSeconds: 5,
    downloadedAt: new Date(0).toISOString(),
    fileSizeBytes: 1000,
    ...overrides,
  };
}

function makeScene(overrides: Partial<VideoScene> = {}): VideoScene {
  return {
    id: "scene-1",
    order: 0,
    narration: "Octopuses have three hearts and blue blood.",
    visualDescription: "close-up of an octopus",
    onScreenText: "",
    estimatedDuration: 5,
    visualKeywords: ["octopus", "marine biology"],
    ...overrides,
  };
}

describe("validateContentQuality (LocalHeuristicProvider)", () => {
  it("passes when the search query shares real words with the narration/keywords", () => {
    const scene = makeScene({ visual: { status: "ready", assets: [makeAsset("octopus close up")] } });
    expect(validateContentQuality([scene]).status).toBe("PASS");
  });

  it("warns when the search query shares no words with narration or keywords", () => {
    const scene = makeScene({ visual: { status: "ready", assets: [makeAsset("sunset beach")] } });
    const result = validateContentQuality([scene]);
    expect(result.status).toBe("WARN");
    expect(result.issues[0].message).toMatch(/relevance mismatch/);
  });

  it("never fails outright — a mismatch is always a WARN, never a FAIL", () => {
    const scene = makeScene({ visual: { status: "ready", assets: [makeAsset("completely unrelated topic")] } });
    expect(validateContentQuality([scene]).status).not.toBe("FAIL");
  });

  it("skips procedural (non-internet) assets — nothing to compare against a search query", () => {
    const scene = makeScene({ visual: { status: "ready", assets: [makeAsset("n/a", { provider: "procedural" })] } });
    expect(validateContentQuality([scene]).status).toBe("PASS");
  });

  it("is a no-op when a scene has no visual assets at all", () => {
    expect(validateContentQuality([makeScene()]).status).toBe("PASS");
  });

  it("supports a custom ContentQualityProvider", () => {
    const provider = { evaluateScene: () => [{ severity: "warn" as const, message: "custom flag" }] };
    const result = validateContentQuality([makeScene()], provider);
    expect(result.status).toBe("WARN");
    expect(result.issues[0].message).toBe("custom flag");
  });

  it("LocalHeuristicProvider is deterministic for the same input", () => {
    const provider = new LocalHeuristicProvider();
    const scene = makeScene({ visual: { status: "ready", assets: [makeAsset("sunset beach")] } });
    expect(provider.evaluateScene(scene)).toEqual(provider.evaluateScene(scene));
  });
});

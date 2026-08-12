import { describe, it, expect } from "vitest";
import { validateVisualQuality } from "./visualQualityValidator.js";
import type { VideoScene, VisualSegment } from "../../types/index.js";

function makeSegment(overrides: Partial<VisualSegment> = {}): VisualSegment {
  return {
    id: "seg-0",
    startTime: 0,
    endTime: 5,
    mediaKind: "color",
    backgroundKind: "gradient",
    colors: ["#111111", "#222222"],
    accentColor: "#facc15",
    cameraMotion: "zoom_in",
    transition: "cut",
    contentType: "none",
    ...overrides,
  };
}

function makeScene(overrides: Partial<VideoScene> = {}): VideoScene {
  return {
    id: "scene-1",
    order: 0,
    narration: "x",
    visualDescription: "",
    onScreenText: "",
    estimatedDuration: 5,
    audio: { status: "ready", duration: 5 },
    visual: { status: "ready", segments: [makeSegment()] },
    ...overrides,
  };
}

describe("validateVisualQuality", () => {
  it("passes a scene with a valid, in-bounds segment", () => {
    const result = validateVisualQuality([makeScene()]);
    expect(result.status).toBe("PASS");
  });

  it("fails a scene with no ready visual", () => {
    const result = validateVisualQuality([makeScene({ visual: { status: "failed" } })]);
    expect(result.status).toBe("FAIL");
  });

  it("fails when a segment overlaps the previous one", () => {
    const segments = [makeSegment({ endTime: 3 }), makeSegment({ id: "seg-1", startTime: 1, endTime: 5 })];
    const result = validateVisualQuality([makeScene({ visual: { status: "ready", segments } })]);
    expect(result.status).toBe("FAIL");
  });

  it("fails when a segment exceeds the scene's audio duration", () => {
    const result = validateVisualQuality([makeScene({ visual: { status: "ready", segments: [makeSegment({ endTime: 50 })] } })]);
    expect(result.status).toBe("FAIL");
  });

  it("fails when a segment references an asset id missing from the scene's asset list", () => {
    const segments = [makeSegment({ mediaKind: "video", assetId: "missing-asset" })];
    const result = validateVisualQuality([makeScene({ visual: { status: "ready", segments, assets: [] } })]);
    expect(result.status).toBe("FAIL");
  });

  it("passes when a referenced asset id is actually present", () => {
    const segments = [makeSegment({ mediaKind: "video", assetId: "asset-1" })];
    const asset = {
      id: "asset-1",
      provider: "pixabay" as const,
      mediaType: "video" as const,
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
    };
    const result = validateVisualQuality([makeScene({ visual: { status: "ready", segments, assets: [asset] } })]);
    expect(result.status).toBe("PASS");
  });

  it("warns when the same visual repeats across 3+ consecutive scenes", () => {
    const scenes = [0, 1, 2].map((i) =>
      makeScene({ id: `scene-${i}`, visual: { status: "ready", segments: [makeSegment({ assetId: "same-asset", mediaKind: "video" })], assets: [] } })
    );
    // assetId references a missing asset too, which would independently FAIL —
    // isolate the repetition signal by giving each scene a real asset entry.
    const withAssets = scenes.map((s) => ({
      ...s,
      visual: {
        ...s.visual!,
        assets: [
          {
            id: "same-asset",
            provider: "pixabay" as const,
            mediaType: "video" as const,
            sourcePageUrl: "https://pixabay.com/x",
            author: null,
            license: "Pixabay License",
            attributionRequired: false,
            attributionText: null,
            query: "ocean",
            width: 1920,
            height: 1080,
            durationSeconds: 5,
            downloadedAt: new Date(0).toISOString(),
            fileSizeBytes: 1000,
          },
        ],
      },
    }));
    const result = validateVisualQuality(withAssets);
    expect(result.status).toBe("WARN");
    expect(result.issues.some((i) => i.message.includes("repeated"))).toBe(true);
  });
});

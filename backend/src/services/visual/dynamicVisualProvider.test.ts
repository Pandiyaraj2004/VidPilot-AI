import { describe, it, expect } from "vitest";
import { DynamicVisualProvider } from "./dynamicVisualProvider.js";
import { LocalVisualProvider } from "./localVisualProvider.js";
import type { AssetProvider } from "./assetTypes.js";
import type { VisualInput } from "./visualProvider.js";

const BASE_INPUT: VisualInput = {
  sceneId: "scene-1",
  sceneOrder: 0,
  jobId: "job-1",
  narration: "Octopuses have three hearts and blue blood.",
  onScreenText: "Three hearts",
  visualDescription: "An octopus swimming underwater",
  language: "en",
  jobStyle: "documentary",
  visualStyleSetting: "automatic",
  emotion: "curiosity",
  energy: 0.7,
  visualKeywords: ["octopus underwater", "octopus anatomy"],
};

function emptyProvider(name: "pixabay" | "pexels" | "wikimedia"): AssetProvider {
  return {
    name,
    supportsVideo: name !== "wikimedia",
    supportsImages: true,
    searchVideos: name !== "wikimedia" ? async () => [] : undefined,
    searchImages: async () => [],
  };
}

describe("DynamicVisualProvider", () => {
  it("falls back to a clean procedural background when the search engine finds nothing, without failing the scene", async () => {
    const provider = new DynamicVisualProvider({
      pixabay: emptyProvider("pixabay"),
      pexels: emptyProvider("pexels"),
      wikimedia: emptyProvider("wikimedia"),
    });

    const result = await provider.generateVisual({ ...BASE_INPUT, audioDuration: 8 });

    expect(result.segments).toBeDefined();
    expect(result.segments!.length).toBeGreaterThan(0);
    for (const seg of result.segments!) {
      expect(seg.mediaKind).toBe("color");
      expect(seg.fallbackUsed).toBe(true);
    }
    expect(result.assets ?? []).toHaveLength(0);
  });

  it("skips internet search entirely (never calls a provider) when skipInternetSearch is set", async () => {
    let called = false;
    const spyProvider: AssetProvider = {
      name: "pixabay",
      supportsVideo: true,
      supportsImages: true,
      searchVideos: async () => {
        called = true;
        return [];
      },
    };
    const provider = new DynamicVisualProvider({ pixabay: spyProvider, pexels: null, wikimedia: null });

    const result = await provider.generateVisual({ ...BASE_INPUT, audioDuration: 8, skipInternetSearch: true });

    expect(called).toBe(false);
    expect(result.segments!.every((s) => s.mediaKind === "color" && s.fallbackUsed === true)).toBe(true);
  });

  it("passes through the legacy single-background result unchanged when there is no audio duration yet", async () => {
    const provider = new DynamicVisualProvider({ pixabay: null, pexels: null, wikimedia: null }, new LocalVisualProvider());
    const result = await provider.generateVisual({ ...BASE_INPUT, audioDuration: undefined });

    expect(result.segments).toBeUndefined();
    expect(result.template).toBeTruthy();
  });

  it("rejects the scene as invalid input when there is no narration or on-screen text (delegated to the local provider)", async () => {
    const provider = new DynamicVisualProvider({ pixabay: null, pexels: null, wikimedia: null });
    await expect(
      provider.generateVisual({ ...BASE_INPUT, narration: "", onScreenText: "", audioDuration: 8 })
    ).rejects.toThrow();
  });
});

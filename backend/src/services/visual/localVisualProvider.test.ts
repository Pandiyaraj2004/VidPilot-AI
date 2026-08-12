import { describe, expect, it } from "vitest";
import { LocalVisualProvider } from "./localVisualProvider.js";
import { VisualProviderError, type VisualInput } from "./visualProvider.js";

const provider = new LocalVisualProvider();

function baseInput(overrides: Partial<VisualInput> = {}): VisualInput {
  return {
    sceneId: "scene-0",
    sceneOrder: 0,
    jobId: "job-abc",
    narration: "Some narration.",
    onScreenText: "Caption",
    visualDescription: "A visual.",
    language: "en",
    jobStyle: "documentary",
    visualStyleSetting: "automatic",
    ...overrides,
  };
}

describe("LocalVisualProvider", () => {
  it("is deterministic for the same job id and style", async () => {
    const a = await provider.generateVisual(baseInput());
    const b = await provider.generateVisual(baseInput());
    expect(a).toEqual(b);
  });

  it("varies template/palette across different job ids", async () => {
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) => provider.generateVisual(baseInput({ jobId: `job-${i}` })))
    );
    const uniqueTemplates = new Set(results.map((r) => r.template));
    const uniquePalettes = new Set(results.map((r) => r.colors.join(",")));
    // With 8 distinct job ids across a small candidate pool, at least some variety is expected.
    expect(uniqueTemplates.size).toBeGreaterThan(1);
    expect(uniquePalettes.size).toBeGreaterThan(1);
  });

  it("only ever picks a candidate template that fits the requested content style", async () => {
    const result = await provider.generateVisual(baseInput({ jobStyle: "list" }));
    expect(["listicle", "facts"]).toContain(result.template);
  });

  it("forces the cartoon template when visualStyleSetting is cartoon, regardless of content style", async () => {
    const result = await provider.generateVisual(baseInput({ jobStyle: "documentary", visualStyleSetting: "cartoon" }));
    expect(result.template).toBe("cartoon");
  });

  it("rejects a scene with no narration and no on-screen text", async () => {
    await expect(provider.generateVisual(baseInput({ narration: "  ", onScreenText: "  " }))).rejects.toThrow(
      VisualProviderError
    );
  });
});

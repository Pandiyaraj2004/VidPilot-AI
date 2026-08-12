import { describe, expect, it } from "vitest";
import { isTooSimilar, validateContentQuality } from "./validators.js";
import type { VideoContentParsed } from "./schema.js";

function makeContent(overrides: Partial<VideoContentParsed> = {}): VideoContentParsed {
  return {
    title: "How Black Holes Work",
    hook: "What happens if you fall into a black hole?",
    introduction: "Black holes are among the most extreme objects in the universe.",
    scenes: [
      {
        id: "scene-1",
        order: 0,
        narration: "A black hole forms when a massive star collapses under its own gravity.",
        visualDescription: "A dying star collapsing inward into a bright point of light.",
        onScreenText: "Stellar Collapse",
        estimatedDuration: 60,
      },
    ],
    conclusion: "Black holes remain one of the great mysteries of physics.",
    description: "An explainer on how black holes form and behave.",
    tags: ["space", "physics"],
    estimatedDuration: 60,
    ...overrides,
  };
}

describe("validateContentQuality", () => {
  it("passes for well-formed content within duration tolerance", () => {
    const errors = validateContentQuality(makeContent(), 60);
    expect(errors).toEqual([]);
  });

  it("flags a scene with too-short narration", () => {
    const content = makeContent({
      scenes: [{ ...makeContent().scenes[0], narration: "Too short." }],
    });
    const errors = validateContentQuality(content, 60);
    expect(errors.some((e) => e.includes("too short"))).toBe(true);
  });

  it("flags duration wildly off from the request", () => {
    const errors = validateContentQuality(makeContent({ estimatedDuration: 6000 }), 60);
    expect(errors.some((e) => e.includes("Estimated duration"))).toBe(true);
  });

  it("flags duplicate scene ordering", () => {
    const scene = makeContent().scenes[0];
    const errors = validateContentQuality(makeContent({ scenes: [scene, { ...scene, id: "scene-2" }] }), 60);
    expect(errors.some((e) => e.includes("duplicate"))).toBe(true);
  });

  it("flags an empty title", () => {
    const errors = validateContentQuality(makeContent({ title: "   " }), 60);
    expect(errors.some((e) => e.includes("title"))).toBe(true);
  });
});

describe("isTooSimilar", () => {
  it("returns false when there is nothing to compare against", () => {
    expect(isTooSimilar(makeContent(), [])).toBe(false);
  });

  it("returns true for near-identical title and hook", () => {
    const recent = [{ title: "How Black Holes Work", hook: "What happens if you fall into a black hole?" }];
    expect(isTooSimilar(makeContent(), recent)).toBe(true);
  });

  it("returns false for a genuinely different topic", () => {
    const recent = [{ title: "The History of Jazz Music", hook: "Where did improvisation come from?" }];
    expect(isTooSimilar(makeContent(), recent)).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import { validateSubtitleQuality } from "./subtitleQualityValidator.js";
import type { VideoScene } from "../../types/index.js";

function makeScene(overrides: Partial<VideoScene> = {}): VideoScene {
  return {
    id: "scene-1",
    order: 0,
    narration: "The ocean covers most of the planet.",
    visualDescription: "",
    onScreenText: "",
    estimatedDuration: 5,
    audio: { status: "ready", duration: 5 },
    subtitles: [{ index: 0, text: "The ocean covers most of the planet.", startSeconds: 0, endSeconds: 5 }],
    ...overrides,
  };
}

describe("validateSubtitleQuality", () => {
  it("passes a scene with valid, in-bounds cues", () => {
    const result = validateSubtitleQuality([makeScene()]);
    expect(result.status).toBe("PASS");
  });

  it("fails when narration exists but there are no cues", () => {
    const result = validateSubtitleQuality([makeScene({ subtitles: [] })]);
    expect(result.status).toBe("FAIL");
    expect(result.issues[0].message).toMatch(/no subtitle cues/);
  });

  it("fails on a negative cue start time", () => {
    const result = validateSubtitleQuality([makeScene({ subtitles: [{ index: 0, text: "x", startSeconds: -1, endSeconds: 2 }] })]);
    expect(result.status).toBe("FAIL");
  });

  it("fails when a cue ends at or before its own start", () => {
    const result = validateSubtitleQuality([makeScene({ subtitles: [{ index: 0, text: "x", startSeconds: 2, endSeconds: 2 }] })]);
    expect(result.status).toBe("FAIL");
  });

  it("fails on empty cue text", () => {
    const result = validateSubtitleQuality([makeScene({ subtitles: [{ index: 0, text: "   ", startSeconds: 0, endSeconds: 5 }] })]);
    expect(result.status).toBe("FAIL");
  });

  it("fails when a cue extends past the scene's own audio duration", () => {
    const result = validateSubtitleQuality([makeScene({ subtitles: [{ index: 0, text: "x", startSeconds: 0, endSeconds: 9 }] })]);
    expect(result.status).toBe("FAIL");
  });

  it("warns (not fails) when a highlight word doesn't appear in the narration", () => {
    const result = validateSubtitleQuality([makeScene({ highlightWords: ["nonexistentword"] })]);
    expect(result.status).toBe("WARN");
  });

  it("passes when highlight words genuinely appear in the narration", () => {
    const result = validateSubtitleQuality([makeScene({ highlightWords: ["ocean", "planet"] })]);
    expect(result.status).toBe("PASS");
  });

  it("is clean for a scene with no narration and no cues (nothing to check)", () => {
    const result = validateSubtitleQuality([makeScene({ narration: "", subtitles: [] })]);
    expect(result.status).toBe("PASS");
  });
});

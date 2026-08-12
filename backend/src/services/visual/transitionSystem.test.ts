import { describe, it, expect } from "vitest";
import { selectTransition, transitionFadeFrames, transitionUsesTransformBurst } from "./transitionSystem.js";

const VALID_TRANSITIONS = new Set(["cut", "crossfade", "fade", "zoom", "slide"]);

describe("selectTransition", () => {
  it("always returns 'cut' for the first segment (index 0), regardless of emotion/energy", () => {
    expect(selectTransition("mystery", 0.9, 0)).toBe("cut");
    expect(selectTransition(undefined, 0.1, 0)).toBe("cut");
    expect(selectTransition("motivation", 0.5, -1)).toBe("cut");
  });

  it("returns a valid TransitionType for every known emotion", () => {
    const emotions = ["curiosity", "motivation", "mystery", "excitement", "calm", "dramatic", "serious", "humorous"];
    for (const emotion of emotions) {
      for (let i = 1; i < 5; i++) {
        expect(VALID_TRANSITIONS.has(selectTransition(emotion, 0.6, i))).toBe(true);
      }
    }
  });

  it("falls back gracefully for an unknown emotion or undefined energy", () => {
    expect(VALID_TRANSITIONS.has(selectTransition("underwater_magic", 0.5, 1))).toBe(true);
    expect(VALID_TRANSITIONS.has(selectTransition(undefined, undefined, 1))).toBe(true);
  });

  it("clamps out-of-range energy", () => {
    expect(VALID_TRANSITIONS.has(selectTransition(undefined, -1, 1))).toBe(true);
    expect(VALID_TRANSITIONS.has(selectTransition(undefined, 5, 1))).toBe(true);
  });
});

describe("transitionFadeFrames", () => {
  it("is exactly 0 for 'cut' — a hard boundary, not a blend", () => {
    expect(transitionFadeFrames("cut")).toBe(0);
  });

  it("is positive for every non-cut transition", () => {
    for (const t of ["crossfade", "fade", "zoom", "slide"] as const) {
      expect(transitionFadeFrames(t)).toBeGreaterThan(0);
    }
  });
});

describe("transitionUsesTransformBurst", () => {
  it("is true only for zoom and slide", () => {
    expect(transitionUsesTransformBurst("zoom")).toBe(true);
    expect(transitionUsesTransformBurst("slide")).toBe(true);
    expect(transitionUsesTransformBurst("cut")).toBe(false);
    expect(transitionUsesTransformBurst("crossfade")).toBe(false);
    expect(transitionUsesTransformBurst("fade")).toBe(false);
  });
});

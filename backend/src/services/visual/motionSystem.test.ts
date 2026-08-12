import { describe, it, expect } from "vitest";
import { selectMotion, isHighImpactMotion, motionRequiresClip } from "./motionSystem.js";

const VALID_MOTIONS = new Set(["zoom_in", "zoom_out", "pan_left", "pan_right", "pan_up", "slow_cinematic", "fast_impact", "static"]);

describe("selectMotion", () => {
  it("returns a valid CameraMotion for every known emotion", () => {
    const emotions = ["curiosity", "motivation", "mystery", "excitement", "calm", "dramatic", "informative", "surprise", "serious", "humorous"];
    for (const emotion of emotions) {
      for (let i = 0; i < 5; i++) {
        const result = selectMotion(emotion, 0.7, i);
        expect(VALID_MOTIONS.has(result)).toBe(true);
      }
    }
  });

  it("falls back gracefully for unknown emotion", () => {
    const result = selectMotion("underwater_magic", 0.5, 0);
    expect(VALID_MOTIONS.has(result)).toBe(true);
  });

  it("falls back gracefully when emotion is undefined", () => {
    const result = selectMotion(undefined, 0.5, 0);
    expect(VALID_MOTIONS.has(result)).toBe(true);
  });

  it("mystery emotion never returns fast_impact on any segment", () => {
    for (let i = 0; i < 10; i++) {
      const result = selectMotion("mystery", 0.8, i);
      expect(result).not.toBe("fast_impact");
    }
  });

  it("high energy (0.9) never returns 'static' on the first segment", () => {
    // High energy should use zoom or impact, not static
    const result = selectMotion(undefined, 0.9, 0);
    expect(result).not.toBe("static");
  });

  it("segments alternate motion (not all the same)", () => {
    const motions = [0, 1, 2, 3, 4].map((i) => selectMotion("curiosity", 0.7, i));
    const unique = new Set(motions);
    expect(unique.size).toBeGreaterThan(1);
  });

  it("handles energy out of range (clamps gracefully)", () => {
    expect(VALID_MOTIONS.has(selectMotion("calm", -0.5, 0))).toBe(true);
    expect(VALID_MOTIONS.has(selectMotion("calm", 2.0, 0))).toBe(true);
  });

  describe("cross-scene motion continuity (Phase 8)", () => {
    it("avoids repeating the previous scene's last motion on this scene's first segment", () => {
      const previous = selectMotion("curiosity", 0.7, 0);
      const next = selectMotion("curiosity", 0.7, 0, previous);
      expect(next).not.toBe(previous);
    });

    it("only applies the continuity check to segmentIndex 0 — later segments are unaffected", () => {
      const withoutContinuity = selectMotion("curiosity", 0.7, 2);
      const withContinuity = selectMotion("curiosity", 0.7, 2, withoutContinuity);
      expect(withContinuity).toBe(withoutContinuity);
    });

    it("is a no-op when there is no previous motion (the job's first scene)", () => {
      const withUndefined = selectMotion("motivation", 0.6, 0, undefined);
      const withoutParam = selectMotion("motivation", 0.6, 0);
      expect(withUndefined).toBe(withoutParam);
    });

    it("still returns a valid motion even when every sequence entry equals the previous motion (single-length sequence edge case can't happen today, but never throws)", () => {
      for (const emotion of ["curiosity", "motivation", "mystery", "excitement", "calm", "dramatic", "serious", "humorous", undefined]) {
        const previous = selectMotion(emotion, 0.5, 0);
        expect(() => selectMotion(emotion, 0.5, 0, previous)).not.toThrow();
      }
    });
  });
});

describe("isHighImpactMotion", () => {
  it("returns true for fast_impact and zoom_in", () => {
    expect(isHighImpactMotion("fast_impact")).toBe(true);
    expect(isHighImpactMotion("zoom_in")).toBe(true);
  });

  it("returns false for static and slow_cinematic", () => {
    expect(isHighImpactMotion("static")).toBe(false);
    expect(isHighImpactMotion("slow_cinematic")).toBe(false);
  });
});

describe("motionRequiresClip", () => {
  it("returns false for static", () => {
    expect(motionRequiresClip("static")).toBe(false);
  });

  it("returns true for all moving motions", () => {
    const moving: string[] = ["zoom_in", "zoom_out", "pan_left", "pan_right", "pan_up", "slow_cinematic", "fast_impact"];
    for (const m of moving) {
      expect(motionRequiresClip(m as any)).toBe(true);
    }
  });
});

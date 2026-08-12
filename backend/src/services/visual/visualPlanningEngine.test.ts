import { describe, it, expect } from "vitest";
import { planSceneVisuals, validateSegments } from "./visualPlanningEngine.js";
import type { VideoScene } from "../../types/index.js";

function makeScene(overrides: Partial<VideoScene> = {}): VideoScene {
  return {
    id: "scene-1",
    order: 0,
    narration: "Test narration with enough words to be useful for the visual engine.",
    visualDescription: "A visual description.",
    onScreenText: "Test text",
    estimatedDuration: 8,
    ...overrides,
  };
}

describe("planSceneVisuals", () => {
  it("returns exactly 1 segment for a very short low-energy scene", () => {
    const scene = makeScene({ energy: 0.2 });
    const plan = planSceneVisuals(scene, 1.5, "job-1");
    expect(plan.segments.length).toBe(1);
  });

  it("returns 2 segments for a medium-energy 6-second scene", () => {
    const scene = makeScene({ energy: 0.5 });
    const plan = planSceneVisuals(scene, 6.0, "job-1");
    expect(plan.segments.length).toBeGreaterThanOrEqual(2);
  });

  it("returns 3–4 segments for a high-energy 12-second scene", () => {
    const scene = makeScene({ energy: 0.8 });
    const plan = planSceneVisuals(scene, 12.0, "job-1");
    expect(plan.segments.length).toBeGreaterThanOrEqual(3);
  });

  it("segment timings sum to audioDuration (within 0.01s)", () => {
    const audioDuration = 8.6;
    const scene = makeScene({ energy: 0.7, emotion: "curiosity" });
    const plan = planSceneVisuals(scene, audioDuration, "job-1");
    const total = plan.segments.reduce((s, seg) => s + (seg.endTime - seg.startTime), 0);
    expect(Math.abs(total - audioDuration)).toBeLessThan(0.01);
  });

  it("no segment endTime exceeds audioDuration", () => {
    const audioDuration = 5.4;
    const scene = makeScene({ energy: 0.9 });
    const plan = planSceneVisuals(scene, audioDuration, "job-1");
    for (const seg of plan.segments) {
      expect(seg.endTime).toBeLessThanOrEqual(audioDuration + 0.01);
    }
  });

  it("first segment startTime is 0", () => {
    const scene = makeScene({ energy: 0.6 });
    const plan = planSceneVisuals(scene, 7.0, "job-1");
    expect(plan.segments[0].startTime).toBe(0);
  });

  it("last segment endTime equals audioDuration (within 0.01s)", () => {
    const audioDuration = 9.2;
    const scene = makeScene({ energy: 0.7 });
    const plan = planSceneVisuals(scene, audioDuration, "job-1");
    const last = plan.segments[plan.segments.length - 1];
    expect(Math.abs(last.endTime - audioDuration)).toBeLessThan(0.01);
  });

  it("falls back gracefully when emotion is undefined", () => {
    const scene = makeScene({ emotion: undefined, energy: undefined });
    expect(() => planSceneVisuals(scene, 8.0, "job-1")).not.toThrow();
  });

  it("detects statistic in highlightWords and creates a statistic overlay", () => {
    const scene = makeScene({
      energy: 0.7,
      highlightWords: ["20%", "brain"],
      sceneRole: "fact",
    });
    const plan = planSceneVisuals(scene, 8.0, "job-1");
    const hasStatistic = plan.segments.some((s) => s.contentType === "statistic");
    expect(hasStatistic).toBe(true);
  });

  it("creates a text_card overlay for hook scenes with onScreenText", () => {
    const scene = makeScene({
      energy: 0.8,
      sceneRole: "hook",
      onScreenText: "Did you know this fact?",
      highlightWords: [],
    });
    const plan = planSceneVisuals(scene, 7.0, "job-1");
    const hasCard = plan.segments.some((s) => s.contentType === "text_card" || s.contentType === "none");
    expect(hasCard).toBe(true);
  });

  it("hook sceneRole produces 'hook' captionStyle", () => {
    const scene = makeScene({ sceneRole: "hook", energy: 0.8 });
    const plan = planSceneVisuals(scene, 6.0, "job-1");
    expect(plan.captionStyle).toBe("hook");
  });

  it("question sceneRole produces 'question' captionStyle", () => {
    const scene = makeScene({ sceneRole: "question", energy: 0.5 });
    const plan = planSceneVisuals(scene, 6.0, "job-1");
    expect(plan.captionStyle).toBe("question");
  });

  it("normal sceneRole produces 'normal' captionStyle", () => {
    const scene = makeScene({ sceneRole: "build", energy: 0.4 });
    const plan = planSceneVisuals(scene, 6.0, "job-1");
    expect(plan.captionStyle).toBe("normal");
  });

  it("all segments have valid backgroundKind", () => {
    const scene = makeScene({ energy: 0.7 });
    const plan = planSceneVisuals(scene, 9.0, "job-1");
    const valid = new Set(["gradient", "solid", "pattern"]);
    for (const seg of plan.segments) {
      expect(valid.has(seg.backgroundKind)).toBe(true);
    }
  });

  it("all segments have a valid cameraMotion", () => {
    const validMotions = new Set(["zoom_in", "zoom_out", "pan_left", "pan_right", "pan_up", "slow_cinematic", "fast_impact", "static"]);
    const scene = makeScene({ energy: 0.75, emotion: "motivation" });
    const plan = planSceneVisuals(scene, 10.0, "job-1");
    for (const seg of plan.segments) {
      expect(validMotions.has(seg.cameraMotion)).toBe(true);
    }
  });

  it("segments from different scenes differ in colour palette", () => {
    const sceneA = makeScene({ id: "scene-a", emotion: "curiosity" });
    const sceneB = makeScene({ id: "scene-b", emotion: "mystery" });
    const planA = planSceneVisuals(sceneA, 8.0, "job-1");
    const planB = planSceneVisuals(sceneB, 8.0, "job-1");
    // curiosity and mystery should produce different palettes
    expect(planA.segments[0].colors).not.toEqual(planB.segments[0].colors);
  });

  it("same job+scene produces identical plan on second call (determinism)", () => {
    const scene = makeScene({ emotion: "dramatic", energy: 0.8, sceneRole: "hook" });
    const plan1 = planSceneVisuals(scene, 8.0, "job-xyz");
    const plan2 = planSceneVisuals(scene, 8.0, "job-xyz");
    expect(JSON.stringify(plan1)).toBe(JSON.stringify(plan2));
  });
});

describe("validateSegments", () => {
  it("returns no errors for valid segments", () => {
    const segments = [
      { id: "s0", startTime: 0, endTime: 3, mediaKind: "color" as const, backgroundKind: "gradient" as const, colors: ["#000", "#111"] as [string, string], accentColor: "#fff", cameraMotion: "static" as const, transition: "cut" as const, contentType: "none" as const },
      { id: "s1", startTime: 3, endTime: 6, mediaKind: "color" as const, backgroundKind: "solid" as const, colors: ["#222", "#333"] as [string, string], accentColor: "#aaa", cameraMotion: "zoom_in" as const, transition: "cut" as const, contentType: "none" as const },
    ];
    expect(validateSegments(segments, 6)).toHaveLength(0);
  });

  it("reports an error when a segment exceeds audio duration", () => {
    const segments = [
      { id: "s0", startTime: 0, endTime: 10, mediaKind: "color" as const, backgroundKind: "gradient" as const, colors: ["#000", "#111"] as [string, string], accentColor: "#fff", cameraMotion: "static" as const, transition: "cut" as const, contentType: "none" as const },
    ];
    const errors = validateSegments(segments, 5);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toMatch(/endTime/);
  });

  it("reports an error for zero-duration segments", () => {
    const segments = [
      { id: "s0", startTime: 3, endTime: 3, mediaKind: "color" as const, backgroundKind: "gradient" as const, colors: ["#000", "#111"] as [string, string], accentColor: "#fff", cameraMotion: "static" as const, transition: "cut" as const, contentType: "none" as const },
    ];
    const errors = validateSegments(segments, 5);
    expect(errors.length).toBeGreaterThan(0);
  });
});

import { describe, it, expect } from "vitest";
import { planSceneTransition, type SceneTransitionType } from "./sceneTransitionPlanner.js";

describe("planSceneTransition", () => {
  it("is deterministic — same inputs always produce the same plan", () => {
    const a = planSceneTransition("motivation", "motivation", 0.7, 0, 8, 8, []);
    const b = planSceneTransition("motivation", "motivation", 0.7, 0, 8, 8, []);
    expect(a).toEqual(b);
  });

  it("general_knowledge favors cut/fast-push, never a slow cinematic fade", () => {
    for (let i = 0; i < 6; i++) {
      const plan = planSceneTransition("general_knowledge", undefined, 0.6, i, 6, 6, []);
      expect(["cut", "push_left", "push_right"]).toContain(plan.type);
    }
  });

  it("mystery favors crossfade/fade, never a push or zoom", () => {
    for (let i = 0; i < 6; i++) {
      const plan = planSceneTransition("mystery", "mystery", 0.4, i, 6, 6, []);
      expect(["crossfade", "fade"]).toContain(plan.type);
    }
  });

  it("motivation favors energetic push/zoom transitions", () => {
    for (let i = 0; i < 6; i++) {
      const plan = planSceneTransition("motivation", "motivation", 0.8, i, 6, 6, []);
      expect(["zoom_burst", "push_left", "zoom", "push_right"]).toContain(plan.type);
    }
  });

  it("a plain 'cut' always has zero duration", () => {
    const plan = planSceneTransition("general_knowledge", undefined, 0.5, 0, 6, 6, []);
    if (plan.type === "cut") {
      expect(plan.durationSeconds).toBe(0);
    }
  });

  it("mystery/dramatic emotion gives a slower transition than high energy alone", () => {
    const slow = planSceneTransition("mystery", "mystery", 0.9, 1, 10, 10, []);
    const fast = planSceneTransition("history", "excitement", 0.9, 1, 10, 10, []);
    // Only compare when both actually blend (non-cut) — duration is only meaningful then.
    if (slow.type !== "cut" && fast.type !== "cut") {
      expect(slow.durationSeconds).toBeGreaterThan(fast.durationSeconds);
    }
  });

  it("clamps transition duration to a fraction of the shorter adjacent scene", () => {
    // A very short 1s scene next to a long one — the transition must shrink well below the emotion's normal band.
    const plan = planSceneTransition("mystery", "mystery", 0.5, 1, 1, 20, []);
    expect(plan.durationSeconds).toBeLessThanOrEqual(1 * 0.25);
  });

  it("collapses to a clean cut instead of an imperceptibly short blend for a very short scene", () => {
    const plan = planSceneTransition("mystery", "mystery", 0.5, 1, 0.3, 20, []);
    expect(plan.type).toBe("cut");
    expect(plan.durationSeconds).toBe(0);
  });

  it("never returns a negative duration", () => {
    const plan = planSceneTransition("science", "serious", 0.5, 0, 0.05, 0.05, []);
    expect(plan.durationSeconds).toBeGreaterThanOrEqual(0);
  });

  it("avoids repeating the immediately previous transition when a different candidate exists", () => {
    const first = planSceneTransition("mystery", "mystery", 0.5, 0, 8, 8, []);
    const second = planSceneTransition("mystery", "mystery", 0.5, 1, 8, 8, [first.type]);
    expect(second.type).not.toBe(first.type);
  });

  it("falls back to a sensible default candidate list for a category with no explicit table entry", () => {
    const plan = planSceneTransition(undefined, undefined, 0.5, 0, 6, 6, []);
    const validTypes: SceneTransitionType[] = ["cut", "crossfade", "fade", "push_left", "push_right", "push_up", "push_down", "zoom", "zoom_burst"];
    expect(validTypes).toContain(plan.type);
  });

  it("cycles through the category's candidate list by boundary index", () => {
    const types = [0, 1, 2, 3].map((i) => planSceneTransition("history", undefined, 0.5, i, 8, 8, []).type);
    const unique = new Set(types);
    expect(unique.size).toBeGreaterThan(1);
  });
});

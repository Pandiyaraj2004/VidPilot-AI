import { describe, it, expect } from "vitest";
import { getCaptionPacing } from "./captionPacing";

describe("getCaptionPacing", () => {
  it("gives high-energy scenes a fast reveal with popping enabled", () => {
    const pacing = getCaptionPacing(null, 0.9, null);
    expect(pacing.popEnabled).toBe(true);
    expect(pacing.revealFrames).toBeLessThanOrEqual(3);
  });

  it("gives low-energy scenes a slow reveal with popping disabled", () => {
    const pacing = getCaptionPacing(null, 0.1, null);
    expect(pacing.popEnabled).toBe(false);
    expect(pacing.revealFrames).toBeGreaterThanOrEqual(7);
  });

  it("treats missing energy as medium (0.5)", () => {
    const withDefault = getCaptionPacing(null, undefined, null);
    const withHalf = getCaptionPacing(null, 0.5, null);
    expect(withDefault).toEqual(withHalf);
  });

  it("mystery emotion overrides energy — slow and restrained even at high energy", () => {
    const pacing = getCaptionPacing("mystery", 0.95, null);
    expect(pacing.revealFrames).toBeGreaterThan(getCaptionPacing(null, 0.95, null).revealFrames);
  });

  it("calm and serious emotions disable popping regardless of energy", () => {
    expect(getCaptionPacing("calm", 0.9, null).popEnabled).toBe(false);
    expect(getCaptionPacing("serious", 0.9, null).popEnabled).toBe(false);
  });

  it("motivation emotion gives a fast reveal and a strong pop", () => {
    const pacing = getCaptionPacing("motivation", 0.5, null);
    expect(pacing.revealFrames).toBeLessThanOrEqual(3);
    expect(pacing.popPeakScale).toBeGreaterThan(1.1);
  });

  it("sceneRole 'reveal' takes precedence over energy and emotion", () => {
    const pacing = getCaptionPacing("calm", 0.9, "reveal");
    expect(pacing.popEnabled).toBe(true);
    expect(pacing.popPeakScale).toBe(1.16);
  });

  it("sceneRole 'question' takes precedence over energy", () => {
    const pacing = getCaptionPacing(null, 0.9, "question");
    expect(pacing.revealFrames).toBe(6);
  });

  it("never exceeds the 1.18 highlight safety-factor ceiling already reserved by subtitleLayout.ts", () => {
    const allConfigs = [
      getCaptionPacing(null, 0, null),
      getCaptionPacing(null, 0.5, null),
      getCaptionPacing(null, 1, null),
      getCaptionPacing("mystery", 0.5, null),
      getCaptionPacing("dramatic", 0.5, null),
      getCaptionPacing("calm", 0.5, null),
      getCaptionPacing("serious", 0.5, null),
      getCaptionPacing("motivation", 0.5, null),
      getCaptionPacing("excitement", 0.5, null),
      getCaptionPacing("curiosity", 0.5, null),
      getCaptionPacing("humorous", 0.5, null),
      getCaptionPacing(null, 0.5, "reveal"),
      getCaptionPacing(null, 0.5, "question"),
    ];
    for (const cfg of allConfigs) {
      expect(cfg.popPeakScale).toBeLessThanOrEqual(1.18);
    }
  });

  it("an unrecognized emotion falls back to the energy tiers", () => {
    const pacing = getCaptionPacing("some_future_emotion", 0.9, null);
    expect(pacing).toEqual(getCaptionPacing(null, 0.9, null));
  });
});

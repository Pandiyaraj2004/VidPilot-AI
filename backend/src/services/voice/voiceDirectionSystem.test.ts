import { describe, it, expect } from "vitest";
import { clampSpeed, deriveVoiceDirection, normalizeEmotion, pauseSeconds } from "./voiceDirectionSystem.js";
import { MAX_VOICE_SPEED, MIN_VOICE_SPEED } from "./voiceConfig.js";

describe("normalizeEmotion", () => {
  it("maps exact Phase 5 vocabulary directly", () => {
    expect(normalizeEmotion("curiosity")).toBe("curiosity");
    expect(normalizeEmotion("mystery")).toBe("mystery");
    expect(normalizeEmotion("informative")).toBe("neutral");
    expect(normalizeEmotion("humorous")).toBe("happy");
  });

  it("maps common synonyms/compound phrases onto the fixed vocabulary", () => {
    expect(normalizeEmotion("very excited")).toBe("excitement");
    expect(normalizeEmotion("high excitement")).toBe("excitement");
    expect(normalizeEmotion("motivational")).toBe("motivation");
    expect(normalizeEmotion("suspenseful")).toBe("suspense");
  });

  it("maps 'energetic' to excitement — found via real AI output during Phase 6 verification, where it had been silently falling back to neutral", () => {
    expect(normalizeEmotion("energetic")).toBe("excitement");
  });

  it("is case-insensitive", () => {
    expect(normalizeEmotion("MYSTERY")).toBe("mystery");
    expect(normalizeEmotion("Motivational")).toBe("motivation");
  });

  it("falls back to neutral for unrecognized or missing input, never passing raw AI text through", () => {
    expect(normalizeEmotion("underwater_magic_feeling")).toBe("neutral");
    expect(normalizeEmotion(undefined)).toBe("neutral");
    expect(normalizeEmotion("")).toBe("neutral");
  });
});

describe("clampSpeed", () => {
  it("pulls a base speed outside the emotion's range into that range", () => {
    expect(clampSpeed(1.0, [1.1, 1.3])).toBeCloseTo(1.1, 5);
    expect(clampSpeed(1.4, [0.85, 1.0])).toBeCloseTo(1.0, 5);
  });

  it("leaves a base speed already inside the range untouched", () => {
    expect(clampSpeed(1.15, [1.0, 1.2])).toBeCloseTo(1.15, 5);
  });

  it("never returns a value outside the global safe bounds regardless of the emotion range", () => {
    const result = clampSpeed(10, [5, 20]);
    expect(result).toBeLessThanOrEqual(MAX_VOICE_SPEED);
    expect(result).toBeGreaterThanOrEqual(MIN_VOICE_SPEED);
  });
});

describe("deriveVoiceDirection", () => {
  it("gives mystery scenes a slower range and a longer default pause than motivation scenes", () => {
    const mystery = deriveVoiceDirection("mystery", undefined);
    const motivation = deriveVoiceDirection("motivation", undefined);
    expect(mystery.speedRange[1]).toBeLessThanOrEqual(motivation.speedRange[0] + 0.05);
    expect(pauseSeconds(mystery.pauseAfterSentence)).toBeGreaterThan(pauseSeconds(motivation.pauseAfterSentence));
  });

  it("assigns a structural pause for hook/question/reveal/clue roles and none for others", () => {
    expect(deriveVoiceDirection("neutral", "hook").structuralPause).toEqual({ position: "after_first", length: "short" });
    expect(deriveVoiceDirection("neutral", "reveal").structuralPause).toEqual({ position: "before_last", length: "dramatic" });
    expect(deriveVoiceDirection("neutral", "build").structuralPause).toBeNull();
    expect(deriveVoiceDirection("neutral", undefined).structuralPause).toBeNull();
  });

  it("only supplies a pitchHint for emotions where one is defined (edge-tts-only feature)", () => {
    expect(deriveVoiceDirection("mystery", undefined).pitchHint).toBeDefined();
    expect(deriveVoiceDirection("neutral", undefined).pitchHint).toBeUndefined();
  });
});

describe("pauseSeconds", () => {
  it("is monotonically increasing across tiers and zero for none/null/undefined", () => {
    expect(pauseSeconds("none")).toBe(0);
    expect(pauseSeconds(null)).toBe(0);
    expect(pauseSeconds(undefined)).toBe(0);
    expect(pauseSeconds("short")).toBeLessThan(pauseSeconds("medium"));
    expect(pauseSeconds("medium")).toBeLessThan(pauseSeconds("long"));
    expect(pauseSeconds("long")).toBeLessThan(pauseSeconds("dramatic"));
  });
});

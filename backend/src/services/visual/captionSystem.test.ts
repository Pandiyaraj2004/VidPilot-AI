import { describe, it, expect } from "vitest";
import { determineCaptionStyle, isCentredCaptionStyle, captionSizeMultiplier } from "./captionSystem.js";

describe("captionSystem", () => {
  describe("determineCaptionStyle", () => {
    it("returns 'hook' when sceneRole is hook", () => {
      expect(determineCaptionStyle("hook", 0.8)).toBe("hook");
      expect(determineCaptionStyle("hook", 0.2)).toBe("hook");
    });

    it("returns 'question' when sceneRole is question", () => {
      expect(determineCaptionStyle("question", 0.5)).toBe("question");
    });

    it("returns 'reveal' when sceneRole is reveal", () => {
      expect(determineCaptionStyle("reveal", 0.8)).toBe("reveal");
    });

    it("returns 'emphasis' for fact/build/action when energy >= 0.6", () => {
      expect(determineCaptionStyle("fact", 0.75)).toBe("emphasis");
      expect(determineCaptionStyle("build", 0.6)).toBe("emphasis");
      expect(determineCaptionStyle("action", 0.9)).toBe("emphasis");
    });

    it("returns 'normal' for fact/build/action when energy < 0.6", () => {
      expect(determineCaptionStyle("fact", 0.55)).toBe("normal");
      expect(determineCaptionStyle("build", 0.3)).toBe("normal");
    });

    it("returns 'normal' for other roles or undefined roles", () => {
      expect(determineCaptionStyle(undefined, undefined)).toBe("normal");
      expect(determineCaptionStyle("conclusion", 0.8)).toBe("normal");
      expect(determineCaptionStyle("transition", 0.9)).toBe("normal");
    });
  });

  describe("isCentredCaptionStyle", () => {
    it("returns true only for hook style", () => {
      expect(isCentredCaptionStyle("hook")).toBe(true);
      expect(isCentredCaptionStyle("normal")).toBe(false);
      expect(isCentredCaptionStyle("emphasis")).toBe(false);
      expect(isCentredCaptionStyle("reveal")).toBe(false);
      expect(isCentredCaptionStyle("question")).toBe(false);
    });
  });

  describe("captionSizeMultiplier", () => {
    it("returns correct multiplier for each style", () => {
      expect(captionSizeMultiplier("hook")).toBe(1.8);
      expect(captionSizeMultiplier("emphasis")).toBe(1.25);
      expect(captionSizeMultiplier("reveal")).toBe(1.35);
      expect(captionSizeMultiplier("question")).toBe(1.1);
      expect(captionSizeMultiplier("normal")).toBe(1.0);
    });
  });
});

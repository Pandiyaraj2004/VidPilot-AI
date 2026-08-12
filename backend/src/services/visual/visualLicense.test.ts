import { describe, it, expect } from "vitest";
import { decidePexelsLicense, decidePixabayLicense, decideWikimediaLicense } from "./visualLicense.js";

describe("decidePixabayLicense / decidePexelsLicense", () => {
  it("are always allowed with no attribution required", () => {
    for (const decide of [decidePixabayLicense, decidePexelsLicense]) {
      const decision = decide();
      expect(decision.allowed).toBe(true);
      expect(decision.attributionRequired).toBe(false);
      expect(decision.attributionText).toBeNull();
    }
  });
});

describe("decideWikimediaLicense — the no-copyright-guessing gate", () => {
  it("allows CC0 with no attribution required", () => {
    const decision = decideWikimediaLicense("CC0", "Jane Doe", "https://commons.wikimedia.org/wiki/File:x.jpg");
    expect(decision.allowed).toBe(true);
    expect(decision.attributionRequired).toBe(false);
  });

  it("allows Public Domain with no attribution required", () => {
    const decision = decideWikimediaLicense("Public domain", null, "https://commons.wikimedia.org/wiki/File:x.jpg");
    expect(decision.allowed).toBe(true);
    expect(decision.attributionRequired).toBe(false);
  });

  it("allows CC BY variants but requires attribution, built from the author", () => {
    const decision = decideWikimediaLicense("CC BY 4.0", "Jane Doe", "https://commons.wikimedia.org/wiki/File:x.jpg");
    expect(decision.allowed).toBe(true);
    expect(decision.attributionRequired).toBe(true);
    expect(decision.attributionText).toContain("Jane Doe");
    expect(decision.attributionText).toContain("CC BY 4.0");
  });

  it("allows CC BY-SA variants and requires attribution", () => {
    const decision = decideWikimediaLicense("CC BY-SA 3.0", "Jane Doe", "https://commons.wikimedia.org/wiki/File:x.jpg");
    expect(decision.allowed).toBe(true);
    expect(decision.attributionRequired).toBe(true);
  });

  it("falls back to a generic attribution label when no author is reported", () => {
    const decision = decideWikimediaLicense("CC BY 2.0", null, "https://commons.wikimedia.org/wiki/File:x.jpg");
    expect(decision.attributionText).toContain("Wikimedia Commons contributor");
  });

  it("rejects 'All rights reserved' outright", () => {
    const decision = decideWikimediaLicense("All rights reserved", "Someone", "url");
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBeTruthy();
  });

  it("rejects an empty/missing license rather than assuming it's safe", () => {
    const decision = decideWikimediaLicense("", null, "url");
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toMatch(/no license/i);
  });

  it("rejects an unrecognized license string rather than guessing", () => {
    const decision = decideWikimediaLicense("Fair use", "Someone", "url");
    expect(decision.allowed).toBe(false);
  });
});

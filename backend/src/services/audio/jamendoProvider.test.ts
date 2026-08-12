import { describe, it, expect } from "vitest";
import { formatCcLicenseLabel, isYouTubeSafeDerivativeLicense, parseCcLicenseSlug } from "./jamendoProvider.js";

describe("parseCcLicenseSlug", () => {
  it("extracts the license slug from a real creativecommons.org URL", () => {
    expect(parseCcLicenseSlug("https://creativecommons.org/licenses/by/4.0/")).toEqual(["by"]);
    expect(parseCcLicenseSlug("http://creativecommons.org/licenses/by-nc-sa/3.0/")).toEqual(["by", "nc", "sa"]);
    expect(parseCcLicenseSlug("https://creativecommons.org/licenses/by-nd/4.0/")).toEqual(["by", "nd"]);
  });

  it("returns null for missing or unparseable input rather than guessing", () => {
    expect(parseCcLicenseSlug(undefined)).toBeNull();
    expect(parseCcLicenseSlug(null)).toBeNull();
    expect(parseCcLicenseSlug("")).toBeNull();
    expect(parseCcLicenseSlug("https://example.com/not-a-license")).toBeNull();
  });
});

describe("isYouTubeSafeDerivativeLicense — the no-copyright-guessing gate for music", () => {
  it("allows plain CC BY", () => {
    expect(isYouTubeSafeDerivativeLicense("https://creativecommons.org/licenses/by/4.0/")).toBe(true);
  });

  it("allows CC BY-SA", () => {
    expect(isYouTubeSafeDerivativeLicense("https://creativecommons.org/licenses/by-sa/4.0/")).toBe(true);
  });

  it("rejects NonCommercial variants — a monetizable YouTube video is commercial use", () => {
    expect(isYouTubeSafeDerivativeLicense("https://creativecommons.org/licenses/by-nc/4.0/")).toBe(false);
    expect(isYouTubeSafeDerivativeLicense("https://creativecommons.org/licenses/by-nc-sa/4.0/")).toBe(false);
  });

  it("rejects NoDerivatives variants — trimming/looping a track is a derivative work", () => {
    expect(isYouTubeSafeDerivativeLicense("https://creativecommons.org/licenses/by-nd/4.0/")).toBe(false);
    expect(isYouTubeSafeDerivativeLicense("https://creativecommons.org/licenses/by-nc-nd/4.0/")).toBe(false);
  });

  it("rejects a missing or unparseable license rather than assuming it's safe", () => {
    expect(isYouTubeSafeDerivativeLicense(undefined)).toBe(false);
    expect(isYouTubeSafeDerivativeLicense("not a real url")).toBe(false);
  });
});

describe("formatCcLicenseLabel", () => {
  it("formats a plain BY license", () => {
    expect(formatCcLicenseLabel("https://creativecommons.org/licenses/by/4.0/")).toBe("CC BY");
  });

  it("formats a BY-SA license", () => {
    expect(formatCcLicenseLabel("https://creativecommons.org/licenses/by-sa/4.0/")).toBe("CC BY-SA");
  });
});

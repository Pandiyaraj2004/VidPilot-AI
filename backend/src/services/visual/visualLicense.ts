/**
 * The one place a candidate's license is judged usable or not. Every
 * AssetProvider reports a raw, unverified license string; nothing downstream
 * of this file may assume "found on the internet" means "free to use."
 *
 * Pixabay and Pexels are platform-licensed: every asset on either site is
 * covered by that platform's own content license (free for commercial and
 * non-commercial use, no attribution required), so those two are trusted by
 * provider alone. Wikimedia Commons hosts files under many different
 * licenses set per-file by the uploader, so each file's actual license
 * field is checked against an allow-list — anything unrecognized is
 * rejected outright, exactly like "no result found."
 */

export interface LicenseDecision {
  allowed: boolean;
  license: string;
  attributionRequired: boolean;
  attributionText: string | null;
  reason?: string;
}

const ALWAYS_ALLOWED_NO_ATTRIBUTION: LicenseDecision = {
  allowed: true,
  license: "",
  attributionRequired: false,
  attributionText: null,
};

export function decidePixabayLicense(): LicenseDecision {
  return { ...ALWAYS_ALLOWED_NO_ATTRIBUTION, license: "Pixabay Content License" };
}

export function decidePexelsLicense(): LicenseDecision {
  return { ...ALWAYS_ALLOWED_NO_ATTRIBUTION, license: "Pexels License" };
}

/** Wikimedia Commons license allow-list — matched case-insensitively against the file's LicenseShortName/UsageTerms. Anything not matched here is rejected, never assumed safe. */
const WIKIMEDIA_NO_ATTRIBUTION_PATTERNS = [/^cc0/i, /public domain/i, /^pd[\s-]/i, /^pd$/i];
const WIKIMEDIA_ATTRIBUTION_PATTERNS = [/^cc[\s-]?by([\s-]?\d(\.\d)?)?$/i, /^cc[\s-]?by[\s-]?sa([\s-]?\d(\.\d)?)?$/i];

export function decideWikimediaLicense(
  rawLicense: string,
  author: string | null,
  sourcePageUrl: string
): LicenseDecision {
  const normalized = rawLicense.trim();
  if (!normalized) {
    return {
      allowed: false,
      license: "",
      attributionRequired: false,
      attributionText: null,
      reason: "No license metadata was reported for this file.",
    };
  }

  if (WIKIMEDIA_NO_ATTRIBUTION_PATTERNS.some((p) => p.test(normalized))) {
    return {
      allowed: true,
      license: normalized,
      attributionRequired: false,
      attributionText: null,
    };
  }

  if (WIKIMEDIA_ATTRIBUTION_PATTERNS.some((p) => p.test(normalized))) {
    const who = author?.trim() || "Wikimedia Commons contributor";
    return {
      allowed: true,
      license: normalized,
      attributionRequired: true,
      attributionText: `"${who}", licensed under ${normalized}, via Wikimedia Commons (${sourcePageUrl})`,
    };
  }

  return {
    allowed: false,
    license: normalized,
    attributionRequired: false,
    attributionText: null,
    reason: `License "${normalized}" is not on the allow-list (CC0/Public Domain/CC BY/CC BY-SA only) — rejected rather than guessed.`,
  };
}

import type { VideoContentParsed } from "./schema.js";

const MIN_SCENE_NARRATION_WORDS = 6;
const DURATION_TOLERANCE_MIN = 0.4;
const DURATION_TOLERANCE_MAX = 2.5;

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Content-safety checks beyond structural schema validity (section 17):
 * empty-after-trim fields, scene ordering, excessively short scenes, and
 * whether the generated duration is in the right ballpark for what was
 * requested. Returns an empty array when the content is good to save.
 */
export function validateContentQuality(content: VideoContentParsed, requestedDurationSeconds: number): string[] {
  const errors: string[] = [];

  if (!content.title.trim()) errors.push("Generated title is empty.");
  if (!content.hook.trim()) errors.push("Generated hook is empty.");
  if (!content.introduction.trim()) errors.push("Generated introduction is empty.");
  if (!content.conclusion.trim()) errors.push("Generated conclusion is empty.");
  if (!content.description.trim()) errors.push("Generated description is empty.");
  if (content.tags.filter((tag) => tag.trim()).length === 0) errors.push("No usable tags were generated.");

  if (content.scenes.length === 0) {
    errors.push("No scenes were generated.");
  } else {
    const orders = content.scenes.map((scene) => scene.order);
    const uniqueOrders = new Set(orders);
    if (uniqueOrders.size !== orders.length) {
      errors.push("Scene ordering has duplicate values.");
    }
    const sorted = [...orders].sort((a, b) => a - b);
    if (JSON.stringify(sorted) !== JSON.stringify(orders)) {
      errors.push("Scenes are not in ascending order.");
    }

    content.scenes.forEach((scene, index) => {
      if (!scene.narration.trim()) errors.push(`Scene ${index + 1} narration is empty.`);
      else if (wordCount(scene.narration) < MIN_SCENE_NARRATION_WORDS) {
        errors.push(`Scene ${index + 1} narration is too short to be useful.`);
      }
      if (!scene.visualDescription.trim()) errors.push(`Scene ${index + 1} is missing a visual description.`);
    });
  }

  if (!Number.isFinite(content.estimatedDuration) || content.estimatedDuration <= 0) {
    errors.push("Estimated duration is invalid.");
  } else {
    const ratio = content.estimatedDuration / requestedDurationSeconds;
    if (ratio < DURATION_TOLERANCE_MIN || ratio > DURATION_TOLERANCE_MAX) {
      errors.push(
        `Estimated duration (${Math.round(content.estimatedDuration)}s) is too far from the requested ${requestedDurationSeconds}s.`
      );
    }
  }

  return errors;
}

export interface ContentFingerprint {
  title: string;
  hook: string;
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((word) => word.length > 2)
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const word of a) {
    if (b.has(word)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

const SIMILARITY_THRESHOLD = 0.6;

/**
 * Lightweight repetition guard (section 18) — not a plagiarism detector,
 * just a word-overlap check on title+hook against recently generated jobs.
 * A single true/false; callers regenerate once with an "avoid this" hint
 * rather than looping indefinitely.
 */
export function isTooSimilar(content: VideoContentParsed, recent: ContentFingerprint[]): boolean {
  const candidateTokens = tokenize(`${content.title} ${content.hook}`);
  return recent.some((sample) => {
    const sampleTokens = tokenize(`${sample.title} ${sample.hook}`);
    return jaccardSimilarity(candidateTokens, sampleTokens) >= SIMILARITY_THRESHOLD;
  });
}

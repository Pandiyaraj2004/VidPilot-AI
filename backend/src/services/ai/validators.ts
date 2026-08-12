import type { VideoContentParsed } from "./schema.js";

const MIN_SCENE_NARRATION_WORDS = 6;
const DURATION_TOLERANCE_MIN = 0.4;
const DURATION_TOLERANCE_MAX = 2.5;

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

const FORBIDDEN_AI_CLICHES = [
  "did you know",
  "in today's video",
  "let's dive in",
  "here are 5 amazing facts",
  "here are five amazing facts",
  "but wait, there's more",
  "you won't believe",
];

/**
 * Content-safety checks beyond structural schema validity:
 * empty-after-trim fields, scene ordering, excessively short scenes, duration bounds,
 * and detection of generic repetitive AI clichés.
 */
export function validateContentQuality(content: VideoContentParsed, requestedDurationSeconds: number): string[] {
  const errors: string[] = [];

  if (!content.title.trim()) errors.push("Generated title is empty.");
  if (!content.hook.trim()) errors.push("Generated hook is empty.");
  if (!content.introduction.trim()) errors.push("Generated introduction is empty.");
  if (!content.description.trim()) errors.push("Generated description is empty.");
  if (content.tags.filter((tag) => tag.trim()).length === 0) errors.push("No usable tags were generated.");

  // Check for forbidden AI cliché phrases across hook, intro, narration
  const fullText = `${content.hook} ${content.introduction} ${content.scenes.map((s) => s.narration).join(" ")}`.toLowerCase();
  for (const cliche of FORBIDDEN_AI_CLICHES) {
    if (fullText.includes(cliche)) {
      errors.push(`Script contains repetitive AI cliché phrase: "${cliche}". Use original humanized wording.`);
    }
  }

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
  storyStructure?: string;
  hookType?: string;
  ctaPattern?: string;
  musicMood?: string;
  visualKeywords?: string[];
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
 * Multi-dimensional repetition guard:
 * Checks text similarity (title/hook), story structure similarity, hook type repetition, and CTA repetition.
 */
export function isTooSimilar(content: VideoContentParsed, recent: ContentFingerprint[]): boolean {
  const candidateTokens = tokenize(`${content.title} ${content.hook}`);
  
  return recent.some((sample) => {
    // 1. Text overlap check
    const sampleTokens = tokenize(`${sample.title} ${sample.hook}`);
    if (jaccardSimilarity(candidateTokens, sampleTokens) >= SIMILARITY_THRESHOLD) {
      return true;
    }
    
    // 2. Structural pattern repetition check (if 2 out of structure/hookType/ctaPattern match recent job)
    let structuralMatches = 0;
    if (content.storyStructure && sample.storyStructure && content.storyStructure === sample.storyStructure) {
      structuralMatches++;
    }
    if (content.hookType && sample.hookType && content.hookType === sample.hookType) {
      structuralMatches++;
    }
    if (content.ctaPattern && sample.ctaPattern && content.ctaPattern === sample.ctaPattern) {
      structuralMatches++;
    }

    if (structuralMatches >= 2) {
      return true;
    }

    return false;
  });
}

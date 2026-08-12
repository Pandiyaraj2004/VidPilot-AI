/**
 * Deterministic thumbnail plan (Phase 11) — decides the background source,
 * headline text, and palette entirely from what the job already generated
 * (Phase 3 content, Phase 5 visuals), never a live AI call. Headline
 * extraction is a documented heuristic, not a claim of AI-level creative
 * headline writing: prefer a short AI-selected highlight phrase, else the
 * hook's first short clause, else a truncated title — always capped short
 * so the thumbnail never carries the whole title (per the spec's own
 * "keep text short and readable" rule).
 */

import type { ContentCategory, VideoJob, VisualAssetMetadata } from "../../types/index.js";

export interface ThumbnailPlan {
  headline: string;
  /** A real, already-downloaded, license-verified asset to use as the background — null when every scene fell back to a procedural background, in which case the composition renders a plain gradient instead. */
  sourceAsset: VisualAssetMetadata | null;
  colors: [string, string];
  accentColor: string;
  emotion: string;
}

const MAX_HEADLINE_CHARS = 28;
const MAX_HEADLINE_WORDS = 5;

// Mirrors the fixed emotion vocabulary already used by voiceDirectionSystem.ts/emotionPalettes.ts — surprise/curiosity reads best with a question mark, motivation/excitement with an exclamation point, everything else plain.
const QUESTION_EMOTIONS = new Set(["curiosity", "surprise", "mystery"]);
const EXCLAMATION_EMOTIONS = new Set(["motivation", "excitement", "awe"]);

function punctuationFor(emotion: string): string {
  if (QUESTION_EMOTIONS.has(emotion)) return "?";
  if (EXCLAMATION_EMOTIONS.has(emotion)) return "!";
  return "";
}

function withinBudget(text: string): boolean {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length > 0 && words.length <= MAX_HEADLINE_WORDS && text.trim().length <= MAX_HEADLINE_CHARS;
}

function truncate(text: string, maxChars: number): string {
  return text.length > maxChars ? `${text.slice(0, maxChars - 1).trimEnd()}…` : text;
}

/** The hook's first clause, split on the same sentence-ish boundaries the subtitle engine already treats as breaks. */
function firstClauseOf(hook: string): string {
  const match = hook.match(/^[^.!?,;:]+/);
  return (match?.[0] ?? hook).trim();
}

function buildHeadline(job: VideoJob, emotion: string): string {
  const content = job.content;
  const punctuation = punctuationFor(emotion);

  const highlightPhrase = content?.scenes[0]?.highlightWords?.join(" ");
  if (highlightPhrase && withinBudget(highlightPhrase)) {
    return `${highlightPhrase.toUpperCase()}${punctuation}`;
  }

  const hookClause = content?.hook ? firstClauseOf(content.hook) : null;
  if (hookClause && withinBudget(hookClause)) {
    return `${hookClause.toUpperCase()}${punctuation}`;
  }

  const title = content?.title ?? job.topic;
  const words = title.trim().split(/\s+/).filter(Boolean).slice(0, MAX_HEADLINE_WORDS).join(" ");
  return truncate(words, MAX_HEADLINE_CHARS).toUpperCase();
}

/** First real, non-procedural visual asset across all scenes in order — matches "existing licensed visual from the video" as the top preference in the spec's source-priority list. */
function findSourceAsset(job: VideoJob): VisualAssetMetadata | null {
  for (const scene of job.content?.scenes ?? []) {
    const asset = scene.visual?.assets?.[0];
    if (asset) return asset;
  }
  return null;
}

const FALLBACK_PALETTE_BY_CATEGORY: Record<ContentCategory, { colors: [string, string]; accent: string }> = {
  general_knowledge: { colors: ["#0f172a", "#1e40af"], accent: "#67e8f9" },
  mystery: { colors: ["#0c0a09", "#1c1917"], accent: "#a78bfa" },
  motivation: { colors: ["#7c2d12", "#ea580c"], accent: "#fef08a" },
  technology: { colors: ["#0f172a", "#1e3a5f"], accent: "#7dd3fc" },
  ai: { colors: ["#0f172a", "#1e3a5f"], accent: "#7dd3fc" },
  science: { colors: ["#0f172a", "#1e3a5f"], accent: "#7dd3fc" },
  history: { colors: ["#1c0a00", "#92400e"], accent: "#fde68a" },
  space: { colors: ["#030712", "#111827"], accent: "#6366f1" },
  facts: { colors: ["#0f172a", "#1e40af"], accent: "#67e8f9" },
  business: { colors: ["#0f172a", "#1e40af"], accent: "#67e8f9" },
  psychology: { colors: ["#1e1b4b", "#4338ca"], accent: "#a5f3fc" },
  story: { colors: ["#0c0a09", "#1c1917"], accent: "#a78bfa" },
  news: { colors: ["#450a0a", "#991b1b"], accent: "#fecaca" },
};

export function planThumbnail(job: VideoJob): ThumbnailPlan {
  const firstScene = job.content?.scenes[0];
  const emotion = firstScene?.emotion ?? "informative";
  const sourceAsset = findSourceAsset(job);

  const paletteFromScene = firstScene?.visual?.colors && firstScene.visual.accentColor
    ? { colors: firstScene.visual.colors as [string, string], accent: firstScene.visual.accentColor }
    : FALLBACK_PALETTE_BY_CATEGORY[job.contentCategory];

  return {
    headline: buildHeadline(job, emotion),
    sourceAsset,
    colors: paletteFromScene.colors,
    accentColor: paletteFromScene.accent,
    emotion,
  };
}

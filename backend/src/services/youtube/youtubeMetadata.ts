/**
 * Builds real YouTube upload metadata entirely from what this job already
 * generated in Phases 3/5/6 — never a second AI architecture, never
 * invented attribution. See youtubeCategoryMap.ts for category mapping.
 */

import { mapContentCategoryToYoutubeCategoryId } from "./youtubeCategoryMap.js";
import type { YouTubeUploadMetadata } from "./youtubeProvider.js";
import type { VideoJob } from "../../types/index.js";

const MAX_TITLE_LENGTH = 100; // YouTube's real hard limit.
const MAX_TAGS_TOTAL_CHARS = 460; // YouTube's real limit is 500 for the joined tags string; a small safety margin.

/** Checked by character code rather than a regex literal (ASCII control ranges below 32, plus 127), excluding tab/newline/carriage-return, which are legitimate in free text. */
function hasInvalidControlCharacters(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    const isAllowedWhitespace = code === 9 || code === 10 || code === 13;
    if (isAllowedWhitespace) continue;
    if (code < 32 || code === 127) return true;
  }
  return false;
}

const SYNTHETIC_MEDIA_DISCLOSURE =
  "Disclosure: this video was produced with AI-assisted narration, visuals, and/or editing (VidPilot AI). Nothing about this disclosure is hidden — see YouTube's own \"Altered or synthetic content\" label on this video.";

export interface TitleValidationResult {
  valid: boolean;
  errors: string[];
}

/** Flags a title that's just the same multi-word phrase immediately repeated (e.g. a generation glitch), not general duplicate-topic detection. */
function hasObviousSelfDuplication(title: string): boolean {
  const words = title.trim().split(/\s+/);
  if (words.length < 6 || words.length % 2 !== 0) return false;
  const half = words.length / 2;
  const first = words.slice(0, half).join(" ").toLowerCase();
  const second = words.slice(half).join(" ").toLowerCase();
  return first === second;
}

export function validateYoutubeTitle(title: string): TitleValidationResult {
  const errors: string[] = [];
  const trimmed = title.trim();

  if (!trimmed) errors.push("Title is empty.");
  if (trimmed.length > MAX_TITLE_LENGTH) errors.push(`Title is ${trimmed.length} characters, over YouTube's ${MAX_TITLE_LENGTH}-character limit.`);
  if (hasInvalidControlCharacters(title)) errors.push("Title contains invalid control characters.");
  if (hasObviousSelfDuplication(trimmed)) errors.push("Title appears to repeat itself.");

  return { valid: errors.length === 0, errors };
}

/**
 * A live AI call to regenerate a title is deliberately NOT triggered here.
 * Phase 9's metadata quality validator already fails a job outright (a
 * CRITICAL issue, blocking the approval gate entirely — see
 * metadataQualityValidator.ts) when job.content.title is missing, so by
 * the time a job is QC-PASSED and Telegram-APPROVED, a real AI-generated
 * title is already guaranteed to exist. This is pure defense-in-depth for
 * an otherwise-unreachable case, so a deterministic fallback from the
 * job's own topic is the right amount of machinery — not a second
 * generation pipeline for a state that can't occur in practice.
 */
function buildFallbackTitle(job: VideoJob): string {
  const topic = job.topic.trim();
  return topic.length > MAX_TITLE_LENGTH ? `${topic.slice(0, MAX_TITLE_LENGTH - 1)}…` : topic;
}

export function buildYoutubeTitle(job: VideoJob): string {
  const aiTitle = job.content?.title?.trim();
  if (aiTitle && validateYoutubeTitle(aiTitle).valid) return aiTitle;
  return buildFallbackTitle(job);
}

interface CreditEntry {
  key: string;
  text: string;
}

function collectMusicCredits(job: VideoJob): string[] {
  const entries = new Map<string, CreditEntry>();
  for (const scene of job.content?.scenes ?? []) {
    const audio = scene.audio;
    if (!audio?.musicAttributionRequired || !audio.musicTrack) continue;
    const key = `${audio.musicTrack}|${audio.musicArtist ?? ""}`;
    if (entries.has(key)) continue;
    const text = audio.musicAttributionText ?? `"${audio.musicTrack}" by ${audio.musicArtist ?? "Unknown artist"} — via ${audio.musicSource ?? "unknown source"}`;
    entries.set(key, { key, text });
  }
  return [...entries.values()].map((e) => e.text);
}

function collectVisualCredits(job: VideoJob): string[] {
  const entries = new Map<string, CreditEntry>();
  for (const scene of job.content?.scenes ?? []) {
    for (const asset of scene.visual?.assets ?? []) {
      if (!asset.attributionRequired || entries.has(asset.id)) continue;
      const text = asset.attributionText ?? `${asset.author ?? "Unknown"} — ${asset.license} (${asset.sourcePageUrl})`;
      entries.set(asset.id, { key: asset.id, text });
    }
  }
  return [...entries.values()].map((e) => e.text);
}

export function buildYoutubeDescription(job: VideoJob): string {
  const parts: string[] = [];
  const aiDescription = job.content?.description?.trim();
  parts.push(aiDescription || job.topic);

  const musicCredits = collectMusicCredits(job);
  if (musicCredits.length > 0) parts.push(["Music", ...musicCredits].join("\n"));

  const visualCredits = collectVisualCredits(job);
  if (visualCredits.length > 0) parts.push(["Visual Credits", ...visualCredits].join("\n"));

  parts.push(SYNTHETIC_MEDIA_DISCLOSURE);

  return parts.join("\n\n");
}

export function buildYoutubeTags(job: VideoJob): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  let totalChars = 0;

  for (const rawTag of job.content?.tags ?? []) {
    const tag = rawTag.trim();
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    // +1 approximates the comma YouTube's own API joins tags with when computing the real 500-char cap.
    if (totalChars + tag.length + 1 > MAX_TAGS_TOTAL_CHARS) break;
    seen.add(key);
    tags.push(tag);
    totalChars += tag.length + 1;
  }

  return tags;
}

/** job.language is already a real ISO 639-1 / BCP-47 code ("en"/"hi"/"ta") — passed through as-is, never silently changed. Tamil stays Tamil. */
export function mapJobLanguageToYoutubeLanguage(language: string): string {
  return language.trim().toLowerCase();
}

export function buildYoutubeUploadMetadata(job: VideoJob): YouTubeUploadMetadata {
  return {
    title: buildYoutubeTitle(job),
    description: buildYoutubeDescription(job),
    tags: buildYoutubeTags(job),
    categoryId: mapContentCategoryToYoutubeCategoryId(job.contentCategory),
    privacyStatus: job.youtubeVisibility,
    defaultLanguage: mapJobLanguageToYoutubeLanguage(job.language),
    madeForKids: false,
    containsSyntheticMedia: true,
  };
}

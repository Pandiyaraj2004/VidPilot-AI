/**
 * Deterministic ContentCategory → real YouTube video category id mapping
 * (Phase 11). Real category ids (stable across YouTube's `videoCategories`
 * API for years, standard for most regions): 22 People & Blogs, 24
 * Entertainment, 25 News & Politics, 27 Education, 28 Science & Technology.
 * Kept in one place, per the spec, rather than scattered through the app.
 */

import type { ContentCategory } from "../../types/index.js";

export const YOUTUBE_CATEGORY_MAP: Record<ContentCategory, string> = {
  // Factual/explainer content — closest real fit is Education.
  general_knowledge: "27",
  facts: "27",
  history: "27",
  psychology: "27",
  business: "27",
  // Tech-specific factual content maps to YouTube's own Science & Technology bucket.
  technology: "28",
  ai: "28",
  science: "28",
  space: "28",
  // Narrative/suspense content is closer to Entertainment than Education.
  mystery: "24",
  story: "24",
  // Motivational shorts are conventionally categorized as People & Blogs on YouTube.
  motivation: "22",
  // Current-events content maps to News & Politics.
  news: "25",
};

export function mapContentCategoryToYoutubeCategoryId(category: ContentCategory): string {
  return YOUTUBE_CATEGORY_MAP[category];
}

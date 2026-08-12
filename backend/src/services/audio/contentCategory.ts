import type { ContentCategory } from "../../types/index.js";

export const VALID_CONTENT_CATEGORIES: ContentCategory[] = [
  "general_knowledge",
  "mystery",
  "motivation",
  "technology",
  "ai",
  "science",
  "history",
  "space",
  "facts",
  "business",
  "psychology",
  "story",
  "news",
];

export const CONTENT_CATEGORY_LABELS: Record<ContentCategory, string> = {
  general_knowledge: "General Knowledge",
  mystery: "Mystery",
  motivation: "Motivation",
  technology: "Technology",
  ai: "AI",
  science: "Science",
  history: "History",
  space: "Space",
  facts: "Facts",
  business: "Business",
  psychology: "Psychology",
  story: "Story",
  news: "News / Current Events",
};

/** The 7 folders under assets/music/ — see that folder's README for the manifest format. */
export type MusicFolder = "motivation" | "curiosity" | "mystery" | "technology" | "emotional" | "energetic" | "general";

/**
 * Deterministic, user-visible mapping — never AI-guessed, since it decides
 * which music plays for the entire video and that needs to be predictable.
 * One consistent musical theme per Short (not per-scene mood flip-flopping)
 * fits short-form content better; see voiceEngine.ts's music lookup.
 */
export const CONTENT_CATEGORY_MUSIC_FOLDER: Record<ContentCategory, MusicFolder> = {
  motivation: "motivation",
  general_knowledge: "curiosity",
  facts: "curiosity",
  mystery: "mystery",
  technology: "technology",
  ai: "technology",
  science: "curiosity",
  space: "curiosity",
  psychology: "emotional",
  story: "emotional",
  history: "general",
  business: "general",
  news: "general",
};

export function musicFolderForCategory(category: ContentCategory): MusicFolder {
  return CONTENT_CATEGORY_MUSIC_FOLDER[category];
}

export const VALID_CONTENT_CATEGORIES = [
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
export const CONTENT_CATEGORY_LABELS = {
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
/**
 * Deterministic, user-visible mapping — never AI-guessed, since it decides
 * which music plays for the entire video and that needs to be predictable.
 * One consistent musical theme per Short (not per-scene mood flip-flopping)
 * fits short-form content better; see voiceEngine.ts's music lookup.
 */
export const CONTENT_CATEGORY_MUSIC_FOLDER = {
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
export function musicFolderForCategory(category) {
    return CONTENT_CATEGORY_MUSIC_FOLDER[category];
}

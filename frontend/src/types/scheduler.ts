import type { VideoStyle, ContentCategory } from "./video";

export type YouTubeVisibility = "private" | "unlisted" | "public";

export interface SchedulerConfig {
  automationEnabled: boolean;
  intervalHours: number;
  defaultStyle: VideoStyle;
  defaultDurationSeconds: number;
  requireApproval: boolean;
  youtubeVisibility: YouTubeVisibility;
  lastGenerationAt: string | null;
  nextGenerationAt: string | null;
  minDurationSeconds: number;
  maxDurationSeconds: number;
  languages: string[];
  enabledVoices: string[];
  contentCategories: ContentCategory[];
  lastJobId: string | null;
  timezone: string;
  defaultLanguage: string;
  updatedAt?: string;
}

export const DEFAULT_SCHEDULER_CONFIG: SchedulerConfig = {
  automationEnabled: false,
  intervalHours: 4,
  defaultStyle: "explainer",
  defaultDurationSeconds: 35,
  requireApproval: true,
  youtubeVisibility: "public",
  lastGenerationAt: null,
  nextGenerationAt: null,
  minDurationSeconds: 30,
  maxDurationSeconds: 45,
  languages: ["en", "ta", "hi"],
  enabledVoices: ["en_US-amy-medium", "ta-IN-PallaviNeural", "ta-IN-ValluvarNeural", "hi_IN-priyamvada-medium"],
  contentCategories: ["science", "general_knowledge", "technology", "history", "mystery", "motivation", "facts", "space"],
  lastJobId: null,
  timezone: "UTC",
  defaultLanguage: "en",
};

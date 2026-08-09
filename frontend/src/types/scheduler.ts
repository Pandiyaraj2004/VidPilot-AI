import type { VideoStyle } from "./video";

export type YouTubeVisibility = "private" | "unlisted" | "public";

export interface SchedulerConfig {
  automationEnabled: boolean;
  intervalHours: number;
  defaultStyle: VideoStyle;
  defaultDurationSeconds: number;
  defaultLanguage: string;
  requireApproval: boolean;
  youtubeVisibility: YouTubeVisibility;
  lastGenerationAt: string | null;
  nextGenerationAt: string | null;
}

export const DEFAULT_SCHEDULER_CONFIG: SchedulerConfig = {
  automationEnabled: false,
  intervalHours: 15,
  defaultStyle: "text",
  defaultDurationSeconds: 300,
  defaultLanguage: "en",
  requireApproval: true,
  youtubeVisibility: "private",
  lastGenerationAt: null,
  nextGenerationAt: null,
};

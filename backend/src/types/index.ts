/**
 * Domain types shared conceptually with frontend/src/types.
 * Duplicated (not imported) because frontend and backend are separate
 * TypeScript projects in Phase 1; a shared package can be introduced later
 * if/when the two sides need to exchange richer payloads.
 */

export type VideoStyle = "text" | "documentary" | "story" | "qa" | "cartoon";

export type JobStatus =
  | "draft"
  | "queued"
  | "generating_script"
  | "script_review"
  | "generating_voice"
  | "rendering"
  | "quality_check"
  | "ready"
  | "awaiting_approval"
  | "rejected"
  | "regenerating"
  | "approved"
  | "uploading"
  | "processing"
  | "published"
  | "failed"
  | "cancelled";

export interface Scene {
  id: number;
  narration: string;
  visual: string;
  onScreenText: string;
  emotion: string;
  durationSeconds?: number;
}

export interface VideoJob {
  id: string;
  topic: string;
  inputScript: string | null;
  style: VideoStyle;
  structure: string | null;
  status: JobStatus;
  title: string | null;
  description: string | null;
  tags: string[];
  scenes: Scene[];
  voice: string;
  qualityScore: number | null;
  retryCount: number;
  createdAt: string;
  approvedAt: string | null;
  publishedAt: string | null;
  youtubeVideoId: string | null;
  telegramMessageId: string | null;
}

export interface SchedulerConfig {
  automationEnabled: boolean;
  intervalHours: number;
  defaultStyle: VideoStyle;
  defaultDurationSeconds: number;
  requireApproval: boolean;
  youtubeVisibility: "private" | "unlisted" | "public";
  lastGenerationAt: string | null;
  nextGenerationAt: string | null;
}

export interface SystemStatus {
  vidpilot: "operational" | "degraded" | "down";
  database: "connected" | "disconnected";
  automation: "ready" | "not_configured" | "running";
  telegram: "connected" | "not_connected";
  youtube: "connected" | "not_connected";
}

export type VideoStyle = "text" | "documentary" | "story" | "qa" | "cartoon";

export const VIDEO_STYLES: { value: VideoStyle; label: string; available: boolean }[] = [
  { value: "text", label: "Text / Explainer", available: true },
  { value: "documentary", label: "Documentary", available: true },
  { value: "story", label: "Story", available: true },
  { value: "qa", label: "Q&A", available: true },
  { value: "cartoon", label: "Cartoon", available: false },
];

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

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  draft: "Draft",
  queued: "Queued",
  generating_script: "Generating Script",
  script_review: "Script Review",
  generating_voice: "Generating Voice",
  rendering: "Rendering",
  quality_check: "Quality Check",
  ready: "Ready",
  awaiting_approval: "Awaiting Approval",
  rejected: "Rejected",
  regenerating: "Regenerating",
  approved: "Approved",
  uploading: "Uploading",
  processing: "Processing",
  published: "Published",
  failed: "Failed",
  cancelled: "Cancelled",
};

export interface Scene {
  id: number;
  narration: string;
  visual: string;
  onScreenText: string;
  emotion: string;
  durationSeconds?: number;
}

export interface VideoMetadata {
  title: string;
  description: string;
  tags: string[];
  containsSyntheticMedia: boolean;
}

export interface VideoJob {
  id: string;
  topic: string;
  inputScript: string | null;
  style: VideoStyle;
  structure: string | null;
  status: JobStatus;
  metadata: VideoMetadata | null;
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

export interface YouTubeVideo {
  youtubeVideoId: string;
  title: string;
  publishedAt: string;
  views: number;
  likes: number;
  status: "public" | "unlisted" | "private";
  thumbnailUrl: string | null;
}

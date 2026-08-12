import type { YouTubeVisibility } from "./scheduler";

export type VideoStyle = "explainer" | "documentary" | "story" | "qa" | "list" | "cartoon";

export const VIDEO_STYLES: { value: VideoStyle; label: string; available: boolean }[] = [
  { value: "explainer", label: "Explainer", available: true },
  { value: "documentary", label: "Documentary", available: true },
  { value: "story", label: "Story", available: true },
  { value: "qa", label: "Q&A", available: true },
  { value: "list", label: "List / Facts", available: true },
  { value: "cartoon", label: "Cartoon", available: false },
];

export const VIDEO_STYLE_LABELS: Record<VideoStyle, string> = Object.fromEntries(
  VIDEO_STYLES.map((option) => [option.value, option.label])
) as Record<VideoStyle, string>;

/** Topic domain, distinct from VideoStyle (narrative structure) — deterministically drives which music folder plays for the whole video (backend/src/services/audio/contentCategory.ts), so it's user-selected here, never AI-guessed. */
export type ContentCategory =
  | "general_knowledge"
  | "mystery"
  | "motivation"
  | "technology"
  | "ai"
  | "science"
  | "history"
  | "space"
  | "facts"
  | "business"
  | "psychology"
  | "story"
  | "news";

export const CONTENT_CATEGORIES: { value: ContentCategory; label: string }[] = [
  { value: "general_knowledge", label: "General Knowledge" },
  { value: "mystery", label: "Mystery" },
  { value: "motivation", label: "Motivation" },
  { value: "technology", label: "Technology" },
  { value: "ai", label: "AI" },
  { value: "science", label: "Science" },
  { value: "history", label: "History" },
  { value: "space", label: "Space" },
  { value: "facts", label: "Facts" },
  { value: "business", label: "Business" },
  { value: "psychology", label: "Psychology" },
  { value: "story", label: "Story" },
  { value: "news", label: "News / Current Events" },
];

export const CONTENT_CATEGORY_LABELS: Record<ContentCategory, string> = Object.fromEntries(
  CONTENT_CATEGORIES.map((option) => [option.value, option.label])
) as Record<ContentCategory, string>;

export type VisualStyle = "automatic" | "minimal" | "cinematic" | "educational" | "cartoon";

export const VISUAL_STYLES: { value: VisualStyle; label: string }[] = [
  { value: "automatic", label: "Automatic" },
  { value: "minimal", label: "Minimal" },
  { value: "cinematic", label: "Cinematic" },
  { value: "educational", label: "Educational" },
  { value: "cartoon", label: "Cartoon" },
];

export const VISUAL_STYLE_LABELS: Record<VisualStyle, string> = Object.fromEntries(
  VISUAL_STYLES.map((option) => [option.value, option.label])
) as Record<VisualStyle, string>;

export type AIProviderName = "gemini" | "openrouter";

export const AI_PROVIDER_LABELS: Record<AIProviderName, string> = {
  gemini: "Gemini",
  openrouter: "OpenRouter",
};

export type VoiceProviderName = "piper" | "edge-tts";

export const VOICE_PROVIDER_LABELS: Record<VoiceProviderName, string> = {
  piper: "Piper",
  "edge-tts": "Edge TTS",
};

export type AudioStatus = "pending" | "generating" | "ready" | "failed";

/**
 * Never contains a raw filesystem path in practice — the backend's `path`
 * field is server-internal bookkeeping. Play audio via
 * `/api/jobs/{jobId}/scenes/{sceneId}/audio`, built from IDs you already
 * have, not from this field.
 */
export interface SceneAudio {
  status: AudioStatus;
  path?: string;
  duration?: number;
  format?: string;
  sampleRate?: number;
  provider?: VoiceProviderName;
  error?: string;
  emotion?: string;
  speedApplied?: number;
  musicMood?: string;
  musicTrack?: string;
  musicArtist?: string | null;
  musicSource?: string;
  musicSourceUrl?: string | null;
  musicLicense?: string;
  musicAttributionRequired?: boolean;
  musicAttributionText?: string | null;
}

export type VisualTemplate = "documentary" | "explainer" | "listicle" | "facts" | "cartoon";

export type CameraMotion =
  | "zoom_in"
  | "zoom_out"
  | "pan_left"
  | "pan_right"
  | "pan_up"
  | "slow_cinematic"
  | "fast_impact"
  | "static";

export type VisualMediaKind = "color" | "image" | "video";

export type VisualSourceProvider = "pixabay" | "pexels" | "wikimedia" | "procedural";

export type TransitionType = "cut" | "crossfade" | "fade" | "zoom" | "slide";

/** Never contains a raw local filesystem path — fetch the bytes via `/api/jobs/{jobId}/visuals/{assetId}`. */
export interface VisualAssetMetadata {
  id: string;
  provider: VisualSourceProvider;
  mediaType: "image" | "video";
  sourcePageUrl: string;
  author: string | null;
  license: string;
  attributionRequired: boolean;
  attributionText: string | null;
  query: string;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  downloadedAt: string;
  fileSizeBytes: number;
}

export interface VisualSegment {
  id: string;
  startTime: number;
  endTime: number;
  mediaKind: VisualMediaKind;
  backgroundKind: "gradient" | "solid" | "pattern";
  colors: [string, string];
  accentColor: string;
  cameraMotion: CameraMotion;
  transition: TransitionType;
  assetId?: string;
  fallbackUsed?: boolean;
  contentType: "none" | "text_card" | "statistic" | "quote";
  contentValue?: string;
  contentLabel?: string;
}

export type CaptionStyle = "normal" | "hook" | "emphasis" | "reveal" | "question";

export interface SceneVisual {
  status: AudioStatus;
  template?: VisualTemplate;
  backgroundKind?: "gradient" | "solid" | "pattern";
  colors?: string[];
  accentColor?: string;
  segments?: VisualSegment[];
  assets?: VisualAssetMetadata[];
  emotion?: string;
  captionStyle?: CaptionStyle;
  error?: string;
}

export interface SubtitleCue {
  index: number;
  text: string;
  startSeconds: number;
  endSeconds: number;
}

export interface VideoScene {
  id: string;
  order: number;
  narration: string;
  visualDescription: string;
  onScreenText: string;
  estimatedDuration: number;
  transition?: string;
  audio?: SceneAudio;
  visual?: SceneVisual;
  subtitles?: SubtitleCue[];
  // Phase 5 — scene-level metadata from AI
  emotion?: string;
  energy?: number;
  sceneRole?: string;
  highlightWords?: string[];
  musicMood?: string;
  musicIntensity?: number;
  visualKeywords?: string[];
}

/** Path is a server-internal reference — never used to fetch directly; use the video-serving endpoint (sceneVideoUrl-style helper) instead. */
export interface VideoRenderMetadata {
  status: AudioStatus;
  generatedAt: string | null;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  fps: number | null;
  videoCodec: string | null;
  audioCodec: string | null;
  fileSizeBytes: number | null;
  path: string | null;
  error: string | null;
}

// --- Phase 9: Quality Control ---

/** Per-issue severity. CRITICAL always forces the overall QC status to FAIL regardless of score. */
export type QualitySeverity = "info" | "warn" | "error" | "critical";

export type QualityCheckStatus = "PASS" | "WARN" | "FAIL";

export type QualityCategory = "video" | "audio" | "captions" | "visuals" | "sync" | "metadata" | "content" | "license";

export interface QualityIssue {
  severity: QualitySeverity;
  message: string;
  /** Scene id, when the issue is scene-specific — omitted for job-level issues. */
  sceneId?: string;
}

export interface QualityCheckResult {
  status: QualityCheckStatus;
  /** Real measured values this check was based on — values that were actually read, never expected/configured ones. */
  details: Record<string, unknown>;
  issues: QualityIssue[];
}

export interface QualityReport {
  jobId: string;
  status: QualityCheckStatus;
  score: number;
  checkedAt: string;
  video: QualityCheckResult;
  audio: QualityCheckResult;
  captions: QualityCheckResult;
  visuals: QualityCheckResult;
  sync: QualityCheckResult;
  metadata: QualityCheckResult;
  content: QualityCheckResult;
  license: QualityCheckResult;
  warnings: QualityIssue[];
  failures: QualityIssue[];
}

// --- Phase 10: Telegram Human Approval ---

export type ApprovalStatus = "not_sent" | "sent" | "approved" | "rejected";
export type ApprovalDecision = "approved" | "rejected";

export interface JobApproval {
  status: ApprovalStatus;
  version: number;
  renderVersion: number;
  sentAt: string | null;
  decision: ApprovalDecision | null;
  reason: string | null;
  decidedAt: string | null;
  pendingReasonPromptMessageId: number | null;
}

// --- Phase 11: YouTube Upload + Thumbnail ---

export type YouTubeUploadStatus = "not_uploaded" | "uploading" | "uploaded" | "failed";
export type YouTubeThumbnailUploadStatus = "not_uploaded" | "uploaded" | "failed";

export interface YouTubePublication {
  videoId: string | null;
  url: string | null;
  status: YouTubeUploadStatus;
  uploadedAt: string | null;
  privacyStatus: YouTubeVisibility;
  thumbnailStatus: YouTubeThumbnailUploadStatus;
  containsSyntheticMedia: boolean;
  lastError: string | null;
}

export type ThumbnailStatus = "not_generated" | "generating" | "ready" | "failed";

export interface ThumbnailAsset {
  status: ThumbnailStatus;
  path: string | null;
  width: number | null;
  height: number | null;
  fileSizeBytes: number | null;
  headline: string | null;
  sourceAssetId: string | null;
  generatedAt: string | null;
  error: string | null;
}

export interface VideoContent {
  title: string;
  hook: string;
  introduction: string;
  scenes: VideoScene[];
  conclusion: string;
  description: string;
  tags: string[];
  estimatedDuration: number;
}

export interface VoiceGenerationMetadata {
  provider: VoiceProviderName;
  status: AudioStatus;
  generatedAt: string | null;
  totalDurationSeconds: number | null;
}

export type JobStatus =
  | "draft"
  | "queued"
  | "generating_script"
  | "script_ready"
  | "script_review"
  | "generating_voice"
  | "voice_ready"
  | "generating_visuals"
  | "generating_subtitles"
  | "rendering"
  | "video_validation"
  | "video_ready"
  | "generating_thumbnail"
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
  script_ready: "Script Ready",
  script_review: "Script Review",
  generating_voice: "Generating Voice",
  voice_ready: "Voice Ready",
  generating_visuals: "Generating Visuals",
  generating_subtitles: "Generating Subtitles",
  rendering: "Rendering",
  video_validation: "Validating Video",
  video_ready: "Video Ready",
  generating_thumbnail: "Generating Thumbnail",
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

/** Coarse grouping for queue filters — the granular JobStatus values above are still shown verbatim on badges. */
export type JobStatusGroup = "queued" | "processing" | "awaiting_approval" | "published" | "failed" | "cancelled";

const STATUS_GROUP: Record<JobStatus, JobStatusGroup> = {
  draft: "queued",
  queued: "queued",
  generating_script: "processing",
  script_ready: "processing",
  script_review: "processing",
  generating_voice: "processing",
  voice_ready: "processing",
  generating_visuals: "processing",
  generating_subtitles: "processing",
  rendering: "processing",
  video_validation: "processing",
  video_ready: "processing",
  generating_thumbnail: "processing",
  quality_check: "processing",
  ready: "processing",
  regenerating: "processing",
  uploading: "processing",
  processing: "processing",
  awaiting_approval: "awaiting_approval",
  approved: "processing",
  published: "published",
  rejected: "failed",
  failed: "failed",
  cancelled: "cancelled",
};

export function getJobStatusGroup(status: JobStatus): JobStatusGroup {
  return STATUS_GROUP[status];
}

export interface VideoJob {
  id: string;
  topic: string;
  inputScript: string | null;
  style: VideoStyle;
  contentCategory: ContentCategory;
  durationSeconds: number;
  language: string;
  voiceId: string;
  voiceSpeed: number;
  visualStyle: VisualStyle;
  subtitlesEnabled: boolean;
  thumbnailEnabled: boolean;
  approvalRequired: boolean;
  youtubeVisibility: YouTubeVisibility;
  status: JobStatus;
  content: VideoContent | null;
  scriptProvider: AIProviderName | null;
  scriptModel: string | null;
  scriptGeneratedAt: string | null;
  voiceGeneration: VoiceGenerationMetadata | null;
  renderTemplate: VisualTemplate | null;
  videoRender: VideoRenderMetadata | null;
  qualityReport: QualityReport | null;
  renderVersion: number;
  approval: JobApproval | null;
  thumbnail: ThumbnailAsset | null;
  youtube: YouTubePublication | null;
  lastError: string | null;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  publishedAt: string | null;
  youtubeVideoId: string | null;
  telegramMessageId: string | null;
}

export interface CreateJobInput {
  topic: string;
  inputScript?: string | null;
  style: VideoStyle;
  contentCategory: ContentCategory;
  durationSeconds: number;
  language: string;
  voiceId: string;
  voiceSpeed: number;
  visualStyle: VisualStyle;
  subtitlesEnabled: boolean;
  thumbnailEnabled: boolean;
  approvalRequired: boolean;
  youtubeVisibility: YouTubeVisibility;
}

export interface VoiceOption {
  id: string;
  language: string;
  label: string;
  gender: "female" | "male";
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

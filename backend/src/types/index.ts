/**
 * Domain types shared conceptually with frontend/src/types.
 * Duplicated (not imported) because frontend and backend are separate
 * TypeScript projects; a shared package can be introduced later if/when
 * the two sides need to exchange richer payloads. Keep these two files
 * in sync by hand — the REST API contract between them depends on it.
 */

export type VideoStyle = "explainer" | "documentary" | "story" | "qa" | "list" | "cartoon";

/**
 * Topic domain, distinct from VideoStyle (which describes narrative
 * structure) — deterministically drives music-folder selection (see
 * services/audio/contentCategory.ts) and is passed to the AI content
 * engine as a writing hint. User-selected, never AI-guessed: category
 * selection needs to be predictable since it picks which music folder
 * plays for the whole video.
 */
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

export type VisualStyle = "automatic" | "minimal" | "cinematic" | "educational" | "cartoon";

export type YouTubeVisibility = "private" | "unlisted" | "public";

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

export type AIProviderName = "gemini" | "openrouter";

export type VoiceProviderName = "piper" | "edge-tts";

export type AudioStatus = "pending" | "generating" | "ready" | "failed";

/** Scene-level narration audio — never a raw filesystem path exposed to the frontend; see services/voice/audioStorage.ts. */
export interface SceneAudio {
  status: AudioStatus;
  path?: string;
  duration?: number;
  format?: string;
  sampleRate?: number;
  provider?: VoiceProviderName;
  error?: string;
  // Phase 6 — transparency metadata about the expressive delivery actually
  // applied to this scene (see services/voice/voiceDirectionSystem.ts).
  /** Normalized emotion (fixed vocabulary) that drove pace/pause/pitch choices — not necessarily the AI's raw emotion string. */
  emotion?: string;
  /** The actual speed used after content-aware clamping, distinct from the job's base voiceSpeed. */
  speedApplied?: number;
  /** Set once music mixing (Phase 6) lands a real track for this scene. */
  musicMood?: string;
  /** Real track title, when music was used. */
  musicTrack?: string;
  musicArtist?: string | null;
  /** "Jamendo" (real API) or the local manifest's own source label. */
  musicSource?: string;
  /** The provider's own page for this track, when one exists — for future YouTube description/credits. */
  musicSourceUrl?: string | null;
  musicLicense?: string;
  musicAttributionRequired?: boolean;
  musicAttributionText?: string | null;
}

export type VisualTemplate = "documentary" | "explainer" | "listicle" | "facts" | "cartoon";

/** Direction of camera movement applied to a visual segment during rendering. */
export type CameraMotion =
  | "zoom_in"
  | "zoom_out"
  | "pan_left"
  | "pan_right"
  | "pan_up"
  | "slow_cinematic"
  | "fast_impact"
  | "static";

/** How a visual segment's background is sourced. "color" is the original procedural gradient/solid/pattern path; "image"/"video" reference a downloaded, licensed asset via `assetId`. */
export type VisualMediaKind = "color" | "image" | "video";

/** Where a segment's image/video asset came from. "procedural" means no internet asset was used (fallback). */
export type VisualSourceProvider = "pixabay" | "pexels" | "wikimedia" | "procedural";

/** How adjacent segments blend at their boundary. See services/visual/transitionSystem.ts. */
export type TransitionType = "cut" | "crossfade" | "fade" | "zoom" | "slide";

/**
 * Metadata for one downloaded internet visual asset — always retained so a
 * future YouTube description/credits system can include proper attribution.
 * `id` is a stable hash of (provider, sourceId), used both as the cache key
 * and as the value scenes reference via VisualSegment.assetId. No raw local
 * filesystem path is exposed here — same convention as SceneAudio/
 * VideoRenderMetadata; see services/visual/assetCache.ts.
 */
export interface VisualAssetMetadata {
  id: string;
  provider: VisualSourceProvider;
  mediaType: "image" | "video";
  /** The provider's own page for this asset (for attribution/credits), not a direct file URL. */
  sourcePageUrl: string;
  author: string | null;
  license: string;
  attributionRequired: boolean;
  attributionText: string | null;
  /** The search query that found this asset. */
  query: string;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  downloadedAt: string;
  fileSizeBytes: number;
}

/**
 * One timed visual segment within a scene's visual timeline. Multiple
 * segments per scene create variety — different backgrounds, motions, and
 * optional content overlays — all timed against the scene's real audio
 * duration. See services/visual/visualPlanningEngine.ts.
 */
export interface VisualSegment {
  id: string;
  /** Seconds from the scene start. */
  startTime: number;
  /** Seconds from the scene start. Always <= scene audio duration. */
  endTime: number;
  /** "color" uses backgroundKind/colors directly; "image"/"video" render the asset referenced by assetId (colors/accentColor still used as the loading/letterbox color). */
  mediaKind: VisualMediaKind;
  backgroundKind: "gradient" | "solid" | "pattern";
  colors: [string, string];
  accentColor: string;
  cameraMotion: CameraMotion;
  /** How this segment transitions in from the previous one. */
  transition: TransitionType;
  /** References an entry in SceneVisual.assets when mediaKind is "image"/"video". */
  assetId?: string;
  /** True when an internet asset lookup was attempted but failed/was rejected, and this segment fell back to a procedural background. */
  fallbackUsed?: boolean;
  /** Optional overlay rendered on top of this segment's background. */
  contentType: "none" | "text_card" | "statistic" | "quote";
  /** Primary value for the content overlay (e.g. "20%" for a statistic). */
  contentValue?: string;
  /** Supporting label for the content overlay (e.g. "OF YOUR BODY'S ENERGY"). */
  contentLabel?: string;
}

/** Caption render style that controls layout, size, and positioning. */
export type CaptionStyle = "normal" | "hook" | "emphasis" | "reveal" | "question";

/**
 * Scene-level visual assignment. The MVP provider is deterministic/local.
 * Phase 5 adds a multi-segment timeline (segments) and scene-level metadata.
 * Old jobs without segments fall back to the single-background render path.
 */
export interface SceneVisual {
  status: AudioStatus;
  /** Used by the single-background fallback path when segments is absent. */
  template?: VisualTemplate;
  backgroundKind?: "gradient" | "solid" | "pattern";
  colors?: string[];
  accentColor?: string;
  /** Phase 5: full multi-segment visual timeline. Absence triggers fallback. */
  segments?: VisualSegment[];
  /** Every internet asset used by this scene's segments, one entry per unique asset. */
  assets?: VisualAssetMetadata[];
  /** Scene emotion used to derive palette and motion. */
  emotion?: string;
  /** Caption layout variant for this scene. */
  captionStyle?: CaptionStyle;
  error?: string;
}

/** One readable, time-boxed caption cue. Timing is always derived from the scene's real audio duration — never estimated. See services/subtitle/subtitleEngine.ts. */
export interface SubtitleCue {
  index: number;
  text: string;
  startSeconds: number;
  endSeconds: number;
}

/**
 * One narratable beat of the video. The seam Voice/Visual/Subtitle/Render
 * engines all consume. Phase 5 adds scene-level metadata (emotion, energy,
 * sceneRole, highlightWords, musicMood) produced by the AI content engine.
 * All new fields are optional — old saved jobs that lack them remain valid.
 */
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
  /** Emotional tone: curiosity | motivation | mystery | excitement | calm | dramatic | informative | surprise | serious | humorous */
  emotion?: string;
  /** Energy level 0.0 (calm/slow) to 1.0 (intense/fast). Controls segment count and motion intensity. */
  energy?: number;
  /** Narrative role: hook | question | clue | reveal | fact | build | action | conclusion | transition */
  sceneRole?: string;
  /** 1–5 important words from the narration to visually emphasise in captions. */
  highlightWords?: string[];
  /** Mood for background music — consumed by Phase 6 audio engine. */
  musicMood?: string;
  /** Music intensity 0.0–1.0 — consumed by Phase 6 audio engine. */
  musicIntensity?: number;
  /** 2–6 concrete, narration-specific visual search phrases from the AI (e.g. "octopus anatomy diagram" rather than "ocean"). Falls back to a local heuristic derived from visualDescription/narration when absent. */
  visualKeywords?: string[];
  /** Camera movement framing for this scene: static | push_in | pull_out | tracking | close_up | overhead | wide_shot */
  cameraMovement?: string;
  /** Purpose of key editorial choice in this scene */
  editorialNote?: string;
}

/** Job-level voice-generation record. Kept separate from job.status (which
 * moves on to later pipeline stages) so "did voice succeed and when" stays
 * visible after the job progresses — same pattern as scriptProvider/
 * scriptModel/scriptGeneratedAt outliving SCRIPT_READY.
 */
export interface VoiceGenerationMetadata {
  provider: VoiceProviderName;
  status: AudioStatus;
  generatedAt: string | null;
  totalDurationSeconds: number | null;
}

/**
 * Job-level video-render record — the final MP4 lives on disk
 * (services/video/videoStorage.ts); this holds only metadata, mirroring
 * VoiceGenerationMetadata's split between job.status and a durable record
 * of what happened. `path` is a server-internal reference, never sent
 * verbatim to the frontend or trusted back from it — see the video
 * streaming route in routes/jobs.ts.
 */
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

/** Structured output of the content engine — never raw AI prose. */
export interface VideoContent {
  title: string;
  hook: string;
  introduction: string;
  scenes: VideoScene[];
  conclusion: string;
  description: string;
  tags: string[];
  estimatedDuration: number;
  /** Primary storytelling structure chosen by the AI content director */
  storyStructure?: string;
  /** Opening hook approach used */
  hookType?: string;
  /** Call to action pattern used */
  ctaPattern?: string;
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
  /** Incremented once per successful render (see renderVideoForJob) — lets an approval record reference exactly which render it covered. */
  renderVersion: number;
  approval: JobApproval | null;
  thumbnail: ThumbnailAsset | null;
  youtube: YouTubePublication | null;
  lastError: string | null;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  /** Denormalized mirror of youtube.uploadedAt, kept in sync — same convention as approvedAt alongside approval.decidedAt. */
  publishedAt: string | null;
  /** Denormalized mirror of youtube.videoId, kept in sync — see above. */
  telegramMessageId: string | null;
  youtubeVideoId: string | null;
  source?: JobSource;
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
  source?: JobSource;
}

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
  updatedAt: string;
}

export type JobSource = "manual" | "scheduled";

// --- Phase 9: Quality Control ---

/** Per-issue severity. CRITICAL always forces the overall QC status to FAIL regardless of score — see services/quality/qualityControlEngine.ts. */
export type QualitySeverity = "info" | "warn" | "error" | "critical";

export type QualityCheckStatus = "PASS" | "WARN" | "FAIL";

export interface QualityIssue {
  severity: QualitySeverity;
  message: string;
  /** Scene id, when the issue is scene-specific — omitted for job-level issues. */
  sceneId?: string;
}

export type QualityCategory = "video" | "audio" | "captions" | "visuals" | "sync" | "metadata" | "content" | "license";

export interface QualityCheckResult {
  status: QualityCheckStatus;
  /** Real measured values this check was based on — values that were actually read, never expected/configured ones. */
  details: Record<string, unknown>;
  issues: QualityIssue[];
}

/**
 * Job-level QC record — same pattern as VideoRenderMetadata: the real
 * generated report lives here, distinct from job.status which moves on to
 * later pipeline stages once QC has run.
 */
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
  /** Every WARN/INFO issue across all categories, flattened for a single UI list. */
  warnings: QualityIssue[];
  /** Every ERROR/CRITICAL issue across all categories, flattened for a single UI list. */
  failures: QualityIssue[];
}

// --- Phase 10: Telegram Human Approval ---

export type ApprovalStatus = "not_sent" | "sent" | "approved" | "rejected";
export type ApprovalDecision = "approved" | "rejected";

/**
 * Job-level approval record — same pattern as VideoRenderMetadata/QualityReport:
 * a durable record of the current approval round, distinct from job.status
 * which moves the job through the pipeline. `version` is the real security
 * boundary (a callback must match the CURRENT version to do anything);
 * `renderVersion` is for audit/display only ("this decision was about
 * render #2"). A fresh render always resets this back to `not_sent`
 * (see services/jobs/jobService.ts's renderVideoForJob) so a stale message
 * from a previous render can never matter even before the version check
 * runs.
 */
export interface JobApproval {
  status: ApprovalStatus;
  version: number;
  renderVersion: number;
  sentAt: string | null;
  decision: ApprovalDecision | null;
  reason: string | null;
  decidedAt: string | null;
  /** Message id of the "please reply with a reason" force-reply prompt — correlates a free-text Telegram reply back to this job. Cleared once a reason is captured. */
  pendingReasonPromptMessageId: number | null;
}

// --- Phase 11: YouTube Upload + Thumbnail ---

export type YouTubeUploadStatus = "not_uploaded" | "uploading" | "uploaded" | "failed";
export type YouTubeThumbnailUploadStatus = "not_uploaded" | "uploaded" | "failed";

/**
 * Job-level YouTube publication record — same pattern as VideoRenderMetadata/
 * QualityReport/JobApproval: the durable record of the real upload attempt,
 * distinct from job.status which moves the job through the pipeline.
 * `videoId`/`url` are only ever set after a real, successful
 * `videos.insert` call — never fabricated ahead of time.
 */
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

/**
 * Job-level thumbnail record. `sourceAssetId` references an entry already
 * present in one of the job's own `scene.visual.assets` (real, license-
 * verified) when the background came from a real internet asset — null
 * when it fell back to a procedural gradient, same fallback convention as
 * the visual engine itself.
 */
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

export interface SystemStatus {
  vidpilot: "operational" | "degraded" | "down";
  database: "connected" | "disconnected";
  automation: "ready" | "not_configured" | "running";
  telegram: "connected" | "not_connected";
  youtube: "connected" | "not_connected";
}

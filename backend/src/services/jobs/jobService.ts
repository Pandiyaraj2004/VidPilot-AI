import { generateVideoContent, type AIContentResult } from "../ai/contentEngine.js";
import type { GenerationContext } from "../ai/prompts.js";
import { isTooSimilar, type ContentFingerprint } from "../ai/validators.js";
import { VALID_CONTENT_CATEGORIES } from "../audio/contentCategory.js";
import { runVoiceGeneration, type VoiceEngineOptions, type VoiceEngineResult } from "../voice/voiceEngine.js";
import { getVoiceById, getVoicesForLanguage, isValidVoiceSpeed } from "../voice/voiceConfig.js";
import { runVisualGeneration, type VisualEngineOptions, type VisualEngineResult } from "../visual/visualEngine.js";
import { runSubtitleGeneration, type SubtitleEngineResult } from "../subtitle/subtitleEngine.js";
import { renderJobVideo, type RenderEngineOptions, type RenderEngineResult } from "../video/renderEngine.js";
import { validateVideoFile, type VideoValidationResult } from "../video/videoValidator.js";
import { runQualityControl } from "../quality/qualityControlEngine.js";
import { youtubeProvider as defaultYoutubeProvider } from "../youtube/index.js";
import type { YouTubeProvider } from "../youtube/youtubeProvider.js";
import { buildYoutubeUploadMetadata } from "../youtube/youtubeMetadata.js";
import { HttpError, NotFoundError, ValidationError } from "../../utils/errors.js";
import type {
  CreateJobInput,
  JobApproval,
  JobStatus,
  QualityReport,
  VideoJob,
  VideoScene,
  VideoStyle,
  VisualStyle,
  YouTubeThumbnailUploadStatus,
  YouTubeVisibility,
} from "../../types/index.js";
import { jobRepository as defaultJobRepository, type JobRepository, type ListJobsFilter } from "./index.js";
import { isSupabaseConfigured } from "../supabase/index.js";
import { uploadToSupabaseBucket } from "../supabase/storage.js";
import { config } from "../../config/env.js";
import path from "node:path";
import fs from "node:fs";
import { ensureLocalVideoFile } from "../video/videoStorage.js";

const VALID_STYLES: VideoStyle[] = ["explainer", "documentary", "story", "qa", "list", "cartoon"];
const VALID_VISUAL_STYLES: VisualStyle[] = ["automatic", "minimal", "cinematic", "educational", "cartoon"];
const VALID_VISIBILITY: YouTubeVisibility[] = ["private", "unlisted", "public"];
const MAX_DURATION_SECONDS = 180 * 60;
const RECENT_SAMPLE_LIMIT = 10;
const GENERATION_FAILURE_MESSAGE =
  "We couldn't generate the script right now. VidPilot will retry automatically or you can try again.";
const VOICE_FAILURE_MESSAGE =
  "We couldn't generate the voice audio right now. VidPilot will retry automatically or you can try again.";
const VIDEO_FAILURE_MESSAGE =
  "We couldn't render the video right now. VidPilot will retry automatically or you can try again.";
const VISUAL_FAILURE_MESSAGE =
  "We couldn't regenerate the visual right now. VidPilot will retry automatically or you can try again.";

const CANCELLABLE_STATUSES: JobStatus[] = [
  "draft",
  "queued",
  "generating_script",
  "script_ready",
  "script_review",
  "generating_voice",
  "voice_ready",
  "generating_visuals",
  "generating_subtitles",
  "rendering",
  "video_validation",
  "generating_thumbnail",
  "quality_check",
  "ready",
  "awaiting_approval",
  "regenerating",
];

const REGENERATABLE_STATUSES: JobStatus[] = ["script_ready", "failed"];
const VOICE_READY_STATUSES: JobStatus[] = ["script_ready", "voice_ready", "failed"];
// "failed" is intentionally broad here (mirrors VOICE_READY_STATUSES above)
// — a job can fail at the visuals/subtitles/render/validation step, and
// retrying re-enters this same guard. The stage runner itself only ever
// re-renders video; visuals/subtitles are skipped when already ready (see
// visualEngine/subtitleEngine's shouldProcess), so retrying never
// regenerates the script or re-runs voice synthesis.
const RENDER_READY_STATUSES: JobStatus[] = ["voice_ready", "video_ready", "failed"];
// "ready" here means "already passed QC once" — re-running QC on a
// previously-passed job (e.g. after a manual scene fix) is allowed, same
// "failed" broadening rationale as the other *_READY_STATUSES above.
const QUALITY_CHECK_READY_STATUSES: JobStatus[] = ["video_ready", "ready", "failed"];
const QUALITY_CHECK_FAILURE_MESSAGE =
  "We couldn't run the quality check right now. VidPilot will retry automatically or you can try again.";

// A previously-sent approval can be resent (e.g. the Telegram message was
// dismissed) without requiring a brand new render.
const APPROVAL_SEND_STATUSES: JobStatus[] = ["ready", "awaiting_approval"];
// Telegram's real ceiling for a bot-uploaded video via sendVideo.
const TELEGRAM_MAX_VIDEO_BYTES = 50 * 1024 * 1024;

// "failed" here means "failed at a previous upload attempt" — approval is
// separately re-checked below (status === "approved" AND renderVersion
// still matches), so a job that failed upload can be retried without
// re-approving, but a job that was never approved (or whose approval is now
// stale because of a fresh render) can never reach this branch regardless
// of job.status.
const UPLOAD_READY_STATUSES: JobStatus[] = ["approved", "failed"];
const YOUTUBE_UPLOAD_FAILURE_MESSAGE =
  "We couldn't upload this video to YouTube right now. You can try again once the issue is resolved.";

export type ApprovalActionFailureReason = "not_found" | "not_awaiting_approval" | "stale_version";
export type ApprovalActionResult =
  | { ok: true; job: VideoJob }
  | { ok: false; reason: ApprovalActionFailureReason };

export function validateCreateJobInput(input: CreateJobInput): string[] {
  const errors: string[] = [];

  if (!input.topic || !input.topic.trim()) {
    errors.push("Please enter a video topic.");
  }
  if (!VALID_STYLES.includes(input.style)) {
    errors.push("Please select a valid video style.");
  }
  if (!VALID_CONTENT_CATEGORIES.includes(input.contentCategory)) {
    errors.push("Please select a valid content category.");
  }
  if (!Number.isFinite(input.durationSeconds) || input.durationSeconds <= 0) {
    errors.push("Please enter a valid duration.");
  } else if (input.durationSeconds > MAX_DURATION_SECONDS) {
    errors.push("Duration is too long.");
  }
  if (!input.language || !input.language.trim()) {
    errors.push("Please select a language.");
  }
  if (input.visualStyle && !VALID_VISUAL_STYLES.includes(input.visualStyle)) {
    errors.push("Please select a valid visual style.");
  }
  if (input.youtubeVisibility && !VALID_VISIBILITY.includes(input.youtubeVisibility)) {
    errors.push("Please select a valid YouTube visibility.");
  }
  // Only require a matching voice when the language actually has one installed —
  // a language with zero Piper voices (e.g. Tamil) is still a valid choice for
  // script generation (Phase 3); it just can't reach VOICE_READY yet. That
  // failure surfaces clearly at the voice-generation step, not here.
  if (getVoicesForLanguage(input.language).length > 0) {
    const voice = getVoiceById(input.voiceId);
    if (!voice) {
      errors.push("Please select a valid voice.");
    } else if (voice.language !== input.language) {
      errors.push(`The selected voice does not match the selected language (${input.language}).`);
    }
  }
  if (input.voiceSpeed !== undefined && !isValidVoiceSpeed(input.voiceSpeed)) {
    errors.push("Please choose a voice speed between 0.75x and 1.5x.");
  }

  return errors;
}

function buildGenerationContext(job: VideoJob, extra?: Partial<GenerationContext>): GenerationContext {
  return {
    topic: job.topic,
    inputScript: job.inputScript,
    style: job.style,
    contentCategory: job.contentCategory,
    durationSeconds: job.durationSeconds,
    language: job.language,
    visualStyle: job.visualStyle,
    ...extra,
  };
}

type GenerateVideoContentFn = (ctx: GenerationContext) => Promise<AIContentResult>;
type RunVoiceGenerationFn = (options: VoiceEngineOptions) => Promise<VoiceEngineResult>;
type RunVisualGenerationFn = (options: VisualEngineOptions) => Promise<VisualEngineResult>;
type RunSubtitleGenerationFn = (options: { scenes: VideoScene[] }) => SubtitleEngineResult;
type RenderJobVideoFn = (options: RenderEngineOptions) => Promise<RenderEngineResult>;
type ValidateVideoFileFn = (filePath: string, expectedAudioDurationSeconds: number) => Promise<VideoValidationResult>;
type RunQualityControlFn = (job: VideoJob) => Promise<QualityReport>;

/**
 * Everything here is parameterized by JobRepository (and, for script/voice/
 * video generation, the underlying engine functions) purely so tests can
 * inject fakes — production code always gets this via the default export
 * below, which binds the real singletons. Controllers import the
 * bottom-level functions and never construct their own orchestrator.
 */
export function createJobOrchestrator(
  repo: JobRepository,
  generate: GenerateVideoContentFn = generateVideoContent,
  runVoice: RunVoiceGenerationFn = runVoiceGeneration,
  runVisual: RunVisualGenerationFn = runVisualGeneration,
  runSubtitle: RunSubtitleGenerationFn = runSubtitleGeneration,
  renderVideo: RenderJobVideoFn = renderJobVideo,
  validateVideo: ValidateVideoFileFn = validateVideoFile,
  runQuality: RunQualityControlFn = runQualityControl,
  youtube: YouTubeProvider = defaultYoutubeProvider
) {
  async function createJob(input: CreateJobInput): Promise<VideoJob> {
    const errors = validateCreateJobInput(input);
    if (errors.length > 0) {
      throw new ValidationError(errors[0], errors);
    }
    return repo.createJob(input);
  }

  async function getJobOrThrow(id: string): Promise<VideoJob> {
    const job = await repo.getJob(id);
    if (!job) {
      throw new NotFoundError(`No job found with id ${id}.`);
    }
    return job;
  }

  async function listJobs(filter?: ListJobsFilter): Promise<VideoJob[]> {
    return repo.listJobs(filter);
  }

  async function cancelJob(id: string): Promise<VideoJob> {
    const job = await getJobOrThrow(id);
    if (!CANCELLABLE_STATUSES.includes(job.status)) {
      throw new ValidationError(`A job in "${job.status}" status can no longer be cancelled.`);
    }
    return repo.updateJobStatus(id, "cancelled");
  }

  async function retryJob(id: string): Promise<VideoJob> {
    const job = await getJobOrThrow(id);
    if (job.status !== "failed") {
      throw new ValidationError("Only a failed job can be retried.");
    }
    return repo.updateJobStatus(id, "queued");
  }

  async function getRecentFingerprints(excludeId: string): Promise<ContentFingerprint[]> {
    try {
      const recent = await repo.listJobs({ limit: 20 });
      return recent
        .filter((job) => job.id !== excludeId && job.content)
        .slice(0, RECENT_SAMPLE_LIMIT)
        .map((job) => {
          const c = job.content!;
          const allKeywords = c.scenes.flatMap((s) => s.visualKeywords ?? []);
          return {
            title: c.title,
            hook: c.hook,
            storyStructure: c.storyStructure,
            hookType: c.hookType,
            ctaPattern: c.ctaPattern,
            musicMood: c.scenes.find((s) => s.musicMood)?.musicMood,
            visualKeywords: allKeywords.slice(0, 5),
          };
        });
    } catch (err) {
      console.warn("[VidPilot] Muting recent job list error:", err instanceof Error ? err.message : String(err));
      return [];
    }
  }

  async function runGeneration(job: VideoJob, extra?: Partial<GenerationContext>): Promise<VideoJob> {
    await repo.updateJobStatus(job.id, "generating_script");

    try {
      const ctx = buildGenerationContext(job, extra);
      let result = await generate(ctx);

      // Best-effort only: the repetition check is a nice-to-have quality
      // pass, not a reason to discard a script that already generated
      // successfully. If Firestore/the query itself fails, skip it.
      try {
        const recentSamples = await getRecentFingerprints(job.id);
        if (isTooSimilar(result.content, recentSamples)) {
          result = await generate({ ...ctx, avoidSimilarTo: recentSamples });
        }
      } catch (repetitionCheckError) {
        console.error("[VidPilot] Repetition check skipped due to an error:", repetitionCheckError);
      }

      return await repo.updateJob(job.id, {
        content: result.content,
        scriptProvider: result.provider,
        scriptModel: result.model ?? null,
        scriptGeneratedAt: result.generatedAt,
        status: "script_ready",
        lastError: null,
        retryCount: job.retryCount + 1,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unexpected error during script generation.";
      await repo.updateJob(job.id, { status: "failed", lastError: message, retryCount: job.retryCount + 1 });
      throw new HttpError(502, GENERATION_FAILURE_MESSAGE);
    }
  }

  async function processQueuedJob(id: string): Promise<VideoJob> {
    const job = await getJobOrThrow(id);
    if (job.status !== "queued") {
      throw new ValidationError(`Job must be QUEUED to generate a script (current status: ${job.status}).`);
    }
    return runGeneration(job);
  }

  async function regenerateScript(id: string, instruction?: string): Promise<VideoJob> {
    const job = await getJobOrThrow(id);
    if (!REGENERATABLE_STATUSES.includes(job.status)) {
      throw new ValidationError(
        `A job in "${job.status}" status cannot be regenerated — it must have a script already, or have failed.`
      );
    }
    return runGeneration(job, instruction ? { instruction } : undefined);
  }

  async function runVoiceStage(
    job: VideoJob,
    options: { force?: boolean; targetSceneId?: string }
  ): Promise<VideoJob> {
    if (!job.content || job.content.scenes.length === 0) {
      throw new ValidationError("This job has no scenes to generate voice for.");
    }
    if (options.targetSceneId && !job.content.scenes.some((scene) => scene.id === options.targetSceneId)) {
      throw new NotFoundError(`No scene found with id ${options.targetSceneId}.`);
    }

    await repo.updateJobStatus(job.id, "generating_voice");

    try {
      const result = await runVoice({
        jobId: job.id,
        language: job.language,
        voiceId: job.voiceId,
        speed: job.voiceSpeed,
        contentCategory: job.contentCategory,
        scenes: job.content.scenes,
        force: options.force,
        targetSceneId: options.targetSceneId,
      });

      // If Supabase is configured, upload the successfully generated audio files to Supabase Storage
      if (result.allReady && isSupabaseConfigured()) {
        for (const scene of result.scenes) {
          if (scene.audio?.status === "ready" && scene.audio.path && fs.existsSync(scene.audio.path)) {
            try {
              const filename = path.basename(scene.audio.path);
              const bucketPath = `${job.id}/audio/${filename}`;
              await uploadToSupabaseBucket("voice-audio", scene.audio.path, bucketPath);
            } catch (uploadErr) {
              console.error(`[VidPilot] Failed to upload audio for scene ${scene.id} to Supabase: ${(uploadErr as Error).message}`);
            }
          }
        }
      }

      const nextStatus: JobStatus = result.allReady ? "voice_ready" : "failed";
      const provider = getVoiceById(job.voiceId)?.provider ?? "piper";
      return await repo.updateJob(job.id, {
        content: { ...job.content, scenes: result.scenes },
        status: nextStatus,
        voiceGeneration: {
          provider,
          status: result.allReady ? "ready" : "failed",
          generatedAt: new Date().toISOString(),
          totalDurationSeconds: result.totalDurationSeconds,
        },
        lastError: result.allReady
          ? null
          : `Voice generation failed for ${result.failedSceneIds.length} of ${job.content.scenes.length} scene(s).`,
        retryCount: job.retryCount + 1,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unexpected error during voice generation.";
      const provider = getVoiceById(job.voiceId)?.provider ?? "piper";
      await repo.updateJob(job.id, {
        status: "failed",
        lastError: message,
        voiceGeneration: { provider, status: "failed", generatedAt: new Date().toISOString(), totalDurationSeconds: null },
        retryCount: job.retryCount + 1,
      });
      throw new HttpError(502, VOICE_FAILURE_MESSAGE);
    }
  }

  async function generateVoiceForJob(id: string): Promise<VideoJob> {
    const job = await getJobOrThrow(id);
    if (job.status !== "script_ready") {
      throw new ValidationError(
        `Job must have a ready script before generating voice (current status: ${job.status}).`
      );
    }
    return runVoiceStage(job, {});
  }

  async function regenerateVoiceForJob(id: string): Promise<VideoJob> {
    const job = await getJobOrThrow(id);
    if (!VOICE_READY_STATUSES.includes(job.status)) {
      throw new ValidationError(`A job in "${job.status}" status cannot regenerate voice.`);
    }
    return runVoiceStage(job, { force: true });
  }

  async function generateVoiceForScene(id: string, sceneId: string): Promise<VideoJob> {
    const job = await getJobOrThrow(id);
    if (job.status !== "script_ready" && !VOICE_READY_STATUSES.includes(job.status)) {
      throw new ValidationError(`A job in "${job.status}" status cannot generate voice.`);
    }
    return runVoiceStage(job, { targetSceneId: sceneId });
  }

  const regenerateVoiceForScene = generateVoiceForScene;

  /**
   * Re-plans and re-sources one scene's visual timeline — a real internet
   * asset search/download, not a re-render — without touching script,
   * voice, or any other scene. Mirrors regenerateVoiceForScene's
   * single-scene shape. A previously rendered final.mp4 no longer matches
   * this scene's new visuals, so a successful regeneration moves the job
   * back to "voice_ready" (the render-ready gate) rather than leaving a
   * stale "video_ready" video displayed as if it were current.
   */
  async function regenerateVisualsForScene(id: string, sceneId: string): Promise<VideoJob> {
    const job = await getJobOrThrow(id);
    if (!job.content || job.content.scenes.length === 0) {
      throw new ValidationError("This job has no scenes to generate visuals for.");
    }
    if (!RENDER_READY_STATUSES.includes(job.status)) {
      throw new ValidationError(`A job in "${job.status}" status cannot regenerate visuals.`);
    }
    const scene = job.content.scenes.find((candidate) => candidate.id === sceneId);
    if (!scene) {
      throw new NotFoundError(`No scene found with id ${sceneId}.`);
    }
    if (scene.audio?.status !== "ready") {
      throw new ValidationError("This scene has no ready narration audio yet — generate voice before visuals.");
    }

    try {
      const visualResult = await runVisual({
        jobId: job.id,
        jobStyle: job.style,
        visualStyleSetting: job.visualStyle,
        language: job.language,
        scenes: job.content.scenes,
        force: true,
        targetSceneId: sceneId,
      });

      const nextStatus: JobStatus = visualResult.allReady ? "voice_ready" : "failed";
      return await repo.updateJob(job.id, {
        content: { ...job.content, scenes: visualResult.scenes },
        status: nextStatus,
        lastError: visualResult.allReady ? null : `Visual generation failed for scene ${sceneId}.`,
        retryCount: job.retryCount + 1,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unexpected error during visual regeneration.";
      await repo.updateJob(job.id, { status: "failed", lastError: message, retryCount: job.retryCount + 1 });
      throw new HttpError(502, VISUAL_FAILURE_MESSAGE);
    }
  }

  /**
   * Runs the whole remaining pipeline — visuals, subtitles, rendering,
   * validation — as one request. Unlike voice generation there is no
   * separate generate/regenerate split: visualEngine/subtitleEngine skip
   * scenes that are already ready (shouldProcess), so calling this again
   * after a rendering failure naturally retries only the rendering step,
   * never re-running voice or (usually) even visuals/subtitles. Rendering
   * itself always re-renders every scene (renderJobVideo has no skip
   * logic — see its own comment for why that's fine).
   */
  async function renderVideoForJob(id: string): Promise<VideoJob> {
    const job = await getJobOrThrow(id);
    if (!job.content || job.content.scenes.length === 0) {
      throw new ValidationError("This job has no scenes to render.");
    }
    if (!RENDER_READY_STATUSES.includes(job.status)) {
      throw new ValidationError(`A job in "${job.status}" status cannot be rendered.`);
    }
    if (!job.content.scenes.every((scene) => scene.audio?.status === "ready")) {
      throw new ValidationError("Every scene must have ready narration audio before rendering.");
    }

    let scenes = job.content.scenes;

    try {
      await repo.updateJobStatus(job.id, "generating_visuals");
      const visualResult = await runVisual({
        jobId: job.id,
        jobStyle: job.style,
        visualStyleSetting: job.visualStyle,
        language: job.language,
        scenes,
      });
      scenes = visualResult.scenes;
      if (!visualResult.allReady) {
        return await repo.updateJob(job.id, {
          content: { ...job.content, scenes },
          status: "failed",
          lastError: `Visual generation failed for ${visualResult.failedSceneIds.length} of ${scenes.length} scene(s).`,
          retryCount: job.retryCount + 1,
        });
      }

      // Persist now, before rendering starts — the render step below makes
      // real HTTP requests back to this same server for each segment's
      // audio/visual assets (GET /jobs/:id/visuals/:assetId), and that
      // route validates the assetId against the job's *persisted* record.
      // Without this, a scene's internet-sourced visuals would 404 during
      // its own render. This also means a retried render reuses already-
      // fetched assets instead of re-searching from scratch.
      await repo.updateJob(job.id, { content: { ...job.content, scenes }, status: "generating_subtitles" });

      const subtitleResult = runSubtitle({ scenes });
      scenes = subtitleResult.scenes;
      if (!subtitleResult.allReady) {
        return await repo.updateJob(job.id, {
          content: { ...job.content, scenes },
          status: "failed",
          lastError: `Subtitle generation failed for ${subtitleResult.failedSceneIds.length} of ${scenes.length} scene(s).`,
          retryCount: job.retryCount + 1,
        });
      }

      await repo.updateJobStatus(job.id, "rendering");
      const renderResult = await renderVideo({ jobId: job.id, language: job.language, scenes, contentCategory: job.contentCategory });

      await repo.updateJobStatus(job.id, "video_validation");
      const validation = await validateVideo(renderResult.finalVideoPath, renderResult.totalDurationSeconds);

      if (!validation.valid) {
        return await repo.updateJob(job.id, {
          content: { ...job.content, scenes },
          status: "failed",
          renderTemplate: visualResult.template,
          videoRender: {
            status: "failed",
            generatedAt: new Date().toISOString(),
            durationSeconds: null,
            width: null,
            height: null,
            fps: null,
            videoCodec: null,
            audioCodec: null,
            fileSizeBytes: null,
            path: null,
            error: validation.errors.join(" "),
          },
          lastError: `Video validation failed: ${validation.errors.join(" ")}`,
          retryCount: job.retryCount + 1,
        });
      }

      let finalVideoPath = renderResult.finalVideoPath;
      if (isSupabaseConfigured()) {
        try {
          const destination = `${job.id}/final.mp4`;
          finalVideoPath = await uploadToSupabaseBucket("rendered-videos", renderResult.finalVideoPath, destination);
        } catch (uploadErr) {
          console.error(`[VidPilot] Failed to upload final video to Supabase Storage: ${(uploadErr as Error).message}`);
        }
      }

      return await repo.updateJob(job.id, {
        content: { ...job.content, scenes },
        status: "video_ready",
        renderTemplate: visualResult.template,
        videoRender: {
          status: "ready",
          generatedAt: new Date().toISOString(),
          durationSeconds: validation.metadata!.durationSeconds,
          width: validation.metadata!.width,
          height: validation.metadata!.height,
          fps: validation.metadata!.fps,
          videoCodec: validation.metadata!.videoCodec,
          audioCodec: validation.metadata!.audioCodec,
          fileSizeBytes: validation.metadata!.fileSizeBytes,
          path: finalVideoPath,
          error: null,
        },
        lastError: null,
        retryCount: job.retryCount + 1,
        // A fresh render invalidates any prior Telegram approval — bumping
        // renderVersion and clearing approval makes "an old approval
        // message can't approve a newer render" true by construction, not
        // just by a version-number check in the callback handler.
        renderVersion: job.renderVersion + 1,
        approval: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unexpected error during video rendering.";
      await repo.updateJob(job.id, {
        content: { ...job.content, scenes },
        status: "failed",
        lastError: message,
        videoRender: {
          status: "failed",
          generatedAt: new Date().toISOString(),
          durationSeconds: null,
          width: null,
          height: null,
          fps: null,
          videoCodec: null,
          audioCodec: null,
          fileSizeBytes: null,
          path: null,
          error: message,
        },
        retryCount: job.retryCount + 1,
      });
      throw new HttpError(502, VIDEO_FAILURE_MESSAGE);
    }
  }

  /**
   * Phase 9 — runs the Quality Control engine against the job's actual
   * rendered MP4 and generated content, never against configuration or
   * expected values. VIDEO_READY -> QUALITY_CHECK (transient, while
   * running) -> READY (PASS or a non-blocking WARN — the existing
   * "already reserved for this" enum value, eligible for Phase 10) or
   * FAILED (a real defect, same recoverable-via-retry convention every
   * other stage already uses — never silently deletes the render).
   */
  async function runQualityCheckForJob(id: string): Promise<VideoJob> {
    const job = await getJobOrThrow(id);
    if (!QUALITY_CHECK_READY_STATUSES.includes(job.status)) {
      throw new ValidationError(`A job in "${job.status}" status cannot be quality-checked.`);
    }
    if (!job.content || job.videoRender?.status !== "ready" || !job.videoRender.path) {
      throw new ValidationError("This job has no rendered video to quality-check yet.");
    }

    await repo.updateJobStatus(job.id, "quality_check");

    try {
      const report = await runQuality(job);
      const passed = report.score >= 70;

      return await repo.updateJob(job.id, {
        qualityReport: report,
        status: passed ? "ready" : "failed",
        lastError: passed
          ? null
          : `Quality check failed: ${report.failures.map((f) => f.message).join(" ") || "see quality report for details."}`,
        retryCount: passed ? job.retryCount : job.retryCount + 1,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unexpected error during quality check.";
      await repo.updateJob(job.id, { status: "failed", lastError: message, retryCount: job.retryCount + 1 });
      throw new HttpError(502, QUALITY_CHECK_FAILURE_MESSAGE);
    }
  }

  /**
   * Phase 10 — validates a job is eligible to be sent for Telegram
   * approval and returns it. Pure guard, no Telegram I/O here (that lives
   * in services/telegram/sendApproval.ts, which calls this first and only
   * persists "sent" state after the provider call actually succeeds).
   */
  async function prepareApprovalSend(id: string): Promise<VideoJob> {
    const job = await getJobOrThrow(id);
    if (!APPROVAL_SEND_STATUSES.includes(job.status)) {
      throw new ValidationError(`A job in "${job.status}" status is not eligible to send for approval.`);
    }
    if (!job.videoRender || job.videoRender.status !== "ready" || !job.videoRender.path) {
      throw new ValidationError("This job has no rendered video to send for approval.");
    }
    if (job.videoRender.fileSizeBytes && job.videoRender.fileSizeBytes > TELEGRAM_MAX_VIDEO_BYTES) {
      throw new ValidationError(
        `This video is ${(job.videoRender.fileSizeBytes / (1024 * 1024)).toFixed(1)}MB, over Telegram's ${TELEGRAM_MAX_VIDEO_BYTES / (1024 * 1024)}MB bot upload limit.`
      );
    }
    return job;
  }

  /** Only called after a real Telegram send succeeds — bumps the approval version so any earlier message becomes stale. */
  async function recordApprovalSent(id: string, telegramMessageId: number): Promise<VideoJob> {
    const job = await getJobOrThrow(id);
    const nextVersion = (job.approval?.version ?? 0) + 1;
    const approval: JobApproval = {
      status: "sent",
      version: nextVersion,
      renderVersion: job.renderVersion,
      sentAt: new Date().toISOString(),
      decision: null,
      reason: null,
      decidedAt: null,
      pendingReasonPromptMessageId: null,
    };
    return repo.updateJob(id, {
      status: "awaiting_approval",
      telegramMessageId: String(telegramMessageId),
      approval,
    });
  }

  // job.status and job.approval.status always transition together (see
  // approveJob/rejectJob below), so once a decision has been made the job
  // is no longer "awaiting_approval" — a duplicate tap is caught by that
  // check alone, with no separate "already decided" state to detect.
  function checkApprovalPreconditions(
    job: VideoJob | null,
    version: number
  ): { ok: true; job: VideoJob; approval: JobApproval } | { ok: false; reason: ApprovalActionFailureReason } {
    if (!job) return { ok: false, reason: "not_found" };
    if (job.status !== "awaiting_approval" || !job.approval) return { ok: false, reason: "not_awaiting_approval" };
    if (job.approval.version !== version) return { ok: false, reason: "stale_version" };
    return { ok: true, job, approval: job.approval };
  }

  /** Records a real Telegram Approve tap. Idempotent/stale-safe via checkApprovalPreconditions — never throws on an expected control-flow case, so the caller (telegramUpdateHandler) can translate each `reason` into the right user-facing message. */
  async function approveJob(id: string, version: number): Promise<ApprovalActionResult> {
    const check = checkApprovalPreconditions(await repo.getJob(id), version);
    if (!check.ok) return check;
    const decidedAt = new Date().toISOString();
    const job = await repo.updateJob(id, {
      status: "approved",
      approvedAt: decidedAt,
      approval: { ...check.approval, status: "approved", decision: "approved", decidedAt },
    });
    return { ok: true, job };
  }

  /** Records that a Reject tap started a reason prompt — remembers the prompt's message id so a later free-text reply (or quick-reason tap) can be correlated back to this job. Does not change job.status yet; the job stays "awaiting_approval" until a reason is actually captured. */
  async function recordPendingRejectionPrompt(id: string, version: number, promptMessageId: number): Promise<ApprovalActionResult> {
    const check = checkApprovalPreconditions(await repo.getJob(id), version);
    if (!check.ok) return check;
    const job = await repo.updateJob(id, {
      approval: { ...check.approval, pendingReasonPromptMessageId: promptMessageId },
    });
    return { ok: true, job };
  }

  /** Records a real Telegram Reject decision (quick-reason tap or free-text reply) with its reason. */
  async function rejectJob(id: string, version: number, reason: string): Promise<ApprovalActionResult> {
    const check = checkApprovalPreconditions(await repo.getJob(id), version);
    if (!check.ok) return check;
    const decidedAt = new Date().toISOString();
    const job = await repo.updateJob(id, {
      status: "rejected",
      approval: {
        ...check.approval,
        status: "rejected",
        decision: "rejected",
        reason,
        decidedAt,
        pendingReasonPromptMessageId: null,
      },
    });
    return { ok: true, job };
  }

  /**
   * Correlates an incoming free-text Telegram reply back to a job. The Bot
   * API gives no "conversation state" — only `reply_to_message.message_id`
   * — so this scans jobs currently awaiting approval (a small, bounded set
   * in this single-user, linear-pipeline app) for the one whose pending
   * reason-prompt message id matches.
   */
  async function findJobAwaitingReasonReply(promptMessageId: number): Promise<VideoJob | null> {
    const candidates = await repo.listJobs({ status: "awaiting_approval" });
    return candidates.find((job) => job.approval?.pendingReasonPromptMessageId === promptMessageId) ?? null;
  }

  /**
   * Phase 11 — the last pipeline step: a real `videos.insert` call via
   * YouTubeProvider. Every precondition here reads from the job's own
   * durable records (qualityReport, approval, videoRender), never from
   * anything the caller supplies — the frontend can never force an
   * approval, a QC pass, or a connected-channel state that isn't real.
   * `approval.renderVersion !== job.renderVersion` specifically catches a
   * fresh re-render that happened after approval (renderVideoForJob always
   * clears `approval` on a new render, but this is defense-in-depth against
   * that invariant ever drifting). Idempotency: a job that already has a
   * real `videoId` refuses a second upload outright — the only way to
   * publish again is a genuinely new job.
   */
  async function uploadVideoForJob(id: string): Promise<VideoJob> {
    const job = await getJobOrThrow(id);

    if (job.youtube?.status === "uploaded" && job.youtube.videoId) {
      throw new ValidationError(
        `This job was already published to YouTube (video ${job.youtube.videoId}) — a job can only be uploaded once.`
      );
    }
    if (!UPLOAD_READY_STATUSES.includes(job.status)) {
      throw new ValidationError(`A job in "${job.status}" status cannot be uploaded to YouTube.`);
    }
    if (job.approval?.status !== "approved" || job.approval.renderVersion !== job.renderVersion) {
      throw new ValidationError(
        "This job has not been approved for its current render — send it for Telegram approval first."
      );
    }
    if (job.qualityReport?.status !== "PASS" && job.qualityReport?.status !== "WARN") {
      throw new ValidationError("This job's quality report is not a PASS or WARN — YouTube upload requires a clean quality check.");
    }
    if (!job.videoRender || job.videoRender.status !== "ready" || !job.videoRender.path) {
      throw new ValidationError("This job has no rendered video to upload.");
    }
    if (!youtube.isConfigured()) {
      throw new ValidationError("YouTube is not configured (missing GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET).");
    }
    if (!(await youtube.isConnected())) {
      throw new ValidationError("YouTube is not connected — connect your YouTube account first.");
    }

    const uploadLockKey = `upload:${job.id}`;
    const { SchedulerLock } = await import("../scheduler/schedulerLock.js");
    const lock = new SchedulerLock();
    const acquired = await lock.acquire(uploadLockKey);
    if (!acquired) {
      console.log(`[JobService] Upload lock already acquired for job ${job.id}. Skipping duplicate upload.`);
      return job;
    }

    const videoPath = await ensureLocalVideoFile(job.id, job.videoRender.path);
    const expectedDuration = job.videoRender.durationSeconds ?? 0;

    await repo.updateJobStatus(job.id, "uploading");

    try {
      // Never trust the stored videoRender metadata for the upload
      // decision, even though QC already re-probed this same file — a
      // real re-inspection of the actual bytes on disk right before the
      // real upload call, per the same "ffprobe over stored JSON" rule
      // videoValidator.ts and the QC engine already follow.
      const revalidation = await validateVideo(videoPath, expectedDuration);
      if (!revalidation.valid) {
        throw new Error(`Pre-upload validation of the rendered file failed: ${revalidation.errors.join(" ")}`);
      }

      const metadata = buildYoutubeUploadMetadata(job);
      const { videoId } = await youtube.uploadVideo({ filePath: videoPath, metadata });

      let thumbnailStatus: YouTubeThumbnailUploadStatus = "not_uploaded";
      if (job.thumbnail?.status === "ready" && job.thumbnail.path) {
        try {
          await youtube.uploadThumbnail(videoId, job.thumbnail.path);
          thumbnailStatus = "uploaded";
        } catch {
          // A thumbnail failure never invalidates a successful video upload.
          thumbnailStatus = "failed";
        }
      }

      const uploadedAt = new Date().toISOString();
      const updated = await repo.updateJob(job.id, {
        status: "published",
        youtube: {
          videoId,
          url: `https://www.youtube.com/watch?v=${videoId}`,
          status: "uploaded",
          uploadedAt,
          privacyStatus: metadata.privacyStatus,
          thumbnailStatus,
          containsSyntheticMedia: metadata.containsSyntheticMedia,
          lastError: null,
        },
        youtubeVideoId: videoId,
        publishedAt: uploadedAt,
        lastError: null,
        retryCount: job.retryCount + 1,
      });

      // Cleanup the job's local processing workspace (storage/jobs/{jobId}) safely
      try {
        const workspacePath = path.join(config.rendering.storageDir, job.id);
        if (fs.existsSync(workspacePath)) {
          await fs.promises.rm(workspacePath, { recursive: true, force: true });
          console.log(`[JobService] Cleaned up local workspace for job ${job.id}.`);
        }
      } catch (cleanupErr) {
        console.warn(`[JobService] Failed to clean up local workspace for job ${job.id}:`, cleanupErr);
      }

      return updated;
    } catch (err) {
      // Release the upload lock so that it can be retried later
      try {
        await lock.release(uploadLockKey);
      } catch (releaseErr) {
        console.warn(`[JobService] Failed to release upload lock for job ${job.id}:`, releaseErr);
      }

      const message = err instanceof Error ? err.message : "Unexpected error during YouTube upload.";
      await repo.updateJob(job.id, {
        status: "failed",
        lastError: message,
        youtube: {
          videoId: null,
          url: null,
          status: "failed",
          uploadedAt: null,
          privacyStatus: job.youtubeVisibility,
          thumbnailStatus: "not_uploaded",
          containsSyntheticMedia: true,
          lastError: message,
        },
        retryCount: job.retryCount + 1,
      });
      throw new HttpError(502, YOUTUBE_UPLOAD_FAILURE_MESSAGE);
    }
  }

  return {
    createJob,
    getJobOrThrow,
    listJobs,
    cancelJob,
    retryJob,
    processQueuedJob,
    regenerateScript,
    generateVoiceForJob,
    regenerateVoiceForJob,
    generateVoiceForScene,
    regenerateVoiceForScene,
    regenerateVisualsForScene,
    renderVideoForJob,
    runQualityCheckForJob,
    prepareApprovalSend,
    recordApprovalSent,
    approveJob,
    recordPendingRejectionPrompt,
    rejectJob,
    findJobAwaitingReasonReply,
    uploadVideoForJob,
  };
}

const defaultOrchestrator = createJobOrchestrator(defaultJobRepository);

export const createJob = defaultOrchestrator.createJob;
export const getJobOrThrow = defaultOrchestrator.getJobOrThrow;
export const listJobs = defaultOrchestrator.listJobs;
export const cancelJob = defaultOrchestrator.cancelJob;
export const retryJob = defaultOrchestrator.retryJob;
export const processQueuedJob = defaultOrchestrator.processQueuedJob;
export const regenerateScript = defaultOrchestrator.regenerateScript;
export const generateVoiceForJob = defaultOrchestrator.generateVoiceForJob;
export const regenerateVoiceForJob = defaultOrchestrator.regenerateVoiceForJob;
export const generateVoiceForScene = defaultOrchestrator.generateVoiceForScene;
export const regenerateVoiceForScene = defaultOrchestrator.regenerateVoiceForScene;
export const regenerateVisualsForScene = defaultOrchestrator.regenerateVisualsForScene;
export const renderVideoForJob = defaultOrchestrator.renderVideoForJob;
export const runQualityCheckForJob = defaultOrchestrator.runQualityCheckForJob;
export const prepareApprovalSend = defaultOrchestrator.prepareApprovalSend;
export const recordApprovalSent = defaultOrchestrator.recordApprovalSent;
export const approveJob = defaultOrchestrator.approveJob;
export const recordPendingRejectionPrompt = defaultOrchestrator.recordPendingRejectionPrompt;
export const rejectJob = defaultOrchestrator.rejectJob;
export const findJobAwaitingReasonReply = defaultOrchestrator.findJobAwaitingReasonReply;
export const uploadVideoForJob = defaultOrchestrator.uploadVideoForJob;

import { runtimeState, type RuntimeState } from "../runtime/state.js";
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
import { YouTubeApiError } from "../youtube/youtubeProvider.js";
import { buildYoutubeUploadMetadata } from "../youtube/youtubeMetadata.js";
import { HttpError, NotFoundError, ValidationError } from "../../utils/errors.js";
import type {
  CreateJobInput,
  JobStatus,
  QualityReport,
  VideoJob,
  VideoScene,
  VideoStyle,
  VisualStyle,
  YouTubeVisibility,
} from "../../types/index.js";
import { jobRepository as defaultJobRepository, type JobRepository, type ListJobsFilter } from "./index.js";
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
  "quality_check",
  "qc_passed",
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
const QUALITY_CHECK_READY_STATUSES: JobStatus[] = ["video_ready", "qc_passed", "failed"];
const QUALITY_CHECK_FAILURE_MESSAGE =
  "We couldn't run the quality check right now. VidPilot will retry automatically or you can try again.";

const UPLOAD_READY_STATUSES: JobStatus[] = ["qc_passed", "failed"];
const YOUTUBE_UPLOAD_FAILURE_MESSAGE =
  "We couldn't upload this video to YouTube right now. You can try again once the issue is resolved.";

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
  youtube: YouTubeProvider = defaultYoutubeProvider,
  publicationState: RuntimeState = runtimeState
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
    if (job.youtube?.status === "uncertain") throw new ValidationError("Reconcile the uncertain upload before retrying.");
    return repo.updateJob(id, {status:"queued",attempts:0,nextAttemptAt:null});
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
        voiceGeneration:null, videoRender:null, qualityReport:null,
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

      const finalVideoPath = renderResult.finalVideoPath;

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
        qualityReport: null,
        renderVersion: job.renderVersion + 1,
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
      const passed = report.status === "PASS";

      return await repo.updateJob(job.id, {
        qualityReport: report,
        status: passed ? "qc_passed" : "failed",
        lastError: passed
          ? null
          : `Quality check failed: ${[...report.failures, ...report.warnings].map((f) => f.message).join(" ") || "see quality report for details."}`,
        retryCount: passed ? job.retryCount : job.retryCount + 1,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unexpected error during quality check.";
      await repo.updateJob(job.id, { status: "failed", lastError: message, retryCount: job.retryCount + 1 });
      throw new HttpError(502, QUALITY_CHECK_FAILURE_MESSAGE);
    }
  }

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
    if (job.qualityReport?.status !== "PASS") {
      throw new ValidationError("This job's quality report is not a PASS — YouTube upload requires a clean quality check.");
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

    const key = `publication:${job.id}`;
    if (await publicationState.get(key)) throw new ValidationError("Publication already started or completed. Reconcile the recorded upload; do not re-upload.");
    let videoPath: string;
    const expectedDuration = job.videoRender.durationSeconds ?? 0;
    let contactedYoutube = false;
    let claimed = false;
    try {
      videoPath = await ensureLocalVideoFile(job.id, job.videoRender!.path!);
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
      claimed = await publicationState.claim(key, {status:"intent",createdAt:new Date().toISOString()});
      if (!claimed) throw new ValidationError("Another worker has already started publication.");
      await repo.updateJobStatus(job.id, "uploading");
      contactedYoutube = true;
      const { videoId } = await youtube.uploadVideo({ filePath: videoPath, metadata });
      await publicationState.set(key, {status:"published",videoId,createdAt:new Date().toISOString()});

      const uploadedAt = new Date().toISOString();
      const updated = await repo.updateJob(job.id, {
        status: "published",
        youtube: {
          videoId,
          url: `https://www.youtube.com/watch?v=${videoId}`,
          status: "uploaded",
          uploadedAt,
          privacyStatus: metadata.privacyStatus,
          containsSyntheticMedia: metadata.containsSyntheticMedia,
          lastError: null,
        },
        youtubeVideoId: videoId,
        publishedAt: uploadedAt,
        lastError: null,
        retryCount: job.retryCount + 1,
      });

      return updated;
    } catch (err) {
      if (!claimed && err instanceof ValidationError) throw err;
      const rejected=err instanceof YouTubeApiError&&["invalid_grant","not_connected","quota_exceeded"].includes(err.reason);
      const uncertain=contactedYoutube&&!rejected;
      if (claimed && !uncertain) await publicationState.remove(key);
      const message = err instanceof Error ? err.message : "Unexpected error during YouTube upload.";
      await repo.updateJob(job.id, {
        status: "failed",
        lastError: message,
        youtube: {
          videoId: null,
          url: null,
          status: uncertain ? "uncertain" : "failed",
          uploadedAt: null,
          privacyStatus: job.youtubeVisibility,
          containsSyntheticMedia: true,
          lastError: message,
        },
        retryCount: job.retryCount + 1,
      });
      throw new HttpError(502, `${YOUTUBE_UPLOAD_FAILURE_MESSAGE} ${message}${uncertain ? " Upload outcome is uncertain; automatic retry is blocked." : ""}`);
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
export const uploadVideoForJob = defaultOrchestrator.uploadVideoForJob;

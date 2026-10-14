import { RuntimeState } from "../runtime/state.js";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AIGenerationError, type AIContentResult } from "../ai/contentEngine.js";
import type { VoiceEngineOptions, VoiceEngineResult } from "../voice/voiceEngine.js";
import type { VisualEngineOptions, VisualEngineResult } from "../visual/visualEngine.js";
import type { SubtitleEngineResult } from "../subtitle/subtitleEngine.js";
import type { RenderEngineOptions, RenderEngineResult } from "../video/renderEngine.js";
import type { VideoValidationResult } from "../video/videoValidator.js";
import type { YouTubeProvider, YouTubeUploadMetadata } from "../youtube/youtubeProvider.js";
import {YouTubeApiError} from "../youtube/youtubeProvider.js";
import type { CreateJobInput, QualityReport, VideoJob, VideoScene } from "../../types/index.js";
import { HttpError, NotFoundError, ValidationError } from "../../utils/errors.js";
import { createJobOrchestrator } from "./jobService.js";
import { LocalJobRepository } from "./localJobRepository.js";

const BASE_INPUT: CreateJobInput = {
  topic: "Test topic",
  style: "explainer",
  contentCategory: "general_knowledge",
  durationSeconds: 60,
  language: "en",
  voiceId: "en_US-amy-medium",
  voiceSpeed: 1.0,
  visualStyle: "automatic",
  subtitlesEnabled: true,
  youtubeVisibility: "private",
};

function fakeContent(): AIContentResult {
  return {
    provider: "gemini",
    content: {
      title: "Test Title",
      hook: "Test hook",
      introduction: "intro",
      scenes: [
        {
          id: "s1",
          order: 0,
          narration: "narration text with enough words to pass validation",
          visualDescription: "a visual description",
          onScreenText: "text",
          estimatedDuration: 60,
        },
      ],
      conclusion: "conclusion",
      description: "description",
      tags: ["tag1"],
      estimatedDuration: 60,
    },
    generatedAt: new Date().toISOString(),
    model: "test-model",
  };
}

function fakeVoiceSuccess() {
  return async (options: VoiceEngineOptions): Promise<VoiceEngineResult> => ({
    scenes: options.scenes.map((scene) => ({
      ...scene,
      audio: { status: "ready" as const, duration: 5, format: "wav", provider: "piper" as const },
    })),
    allReady: true,
    totalDurationSeconds: options.scenes.length * 5,
    failedSceneIds: [],
  });
}

function fakeVoiceFailure() {
  return async (options: VoiceEngineOptions): Promise<VoiceEngineResult> => ({
    scenes: options.scenes.map((scene) => ({
      ...scene,
      audio: { status: "failed" as const, error: "boom", provider: "piper" as const },
    })),
    allReady: false,
    totalDurationSeconds: 0,
    failedSceneIds: options.scenes.map((scene) => scene.id),
  });
}

function fakeVisualSuccess() {
  return async (options: VisualEngineOptions): Promise<VisualEngineResult> => ({
    scenes: options.scenes.map((scene) => ({
      ...scene,
      visual: {
        status: "ready" as const,
        template: "documentary" as const,
        backgroundKind: "gradient" as const,
        colors: ["#111111", "#222222"],
        accentColor: "#ffffff",
      },
    })),
    allReady: true,
    failedSceneIds: [],
    template: "documentary" as const,
  });
}

function fakeVisualFailure() {
  return async (options: VisualEngineOptions): Promise<VisualEngineResult> => ({
    scenes: options.scenes.map((scene) => ({ ...scene, visual: { status: "failed" as const, error: "visual boom" } })),
    allReady: false,
    failedSceneIds: options.scenes.map((scene) => scene.id),
    template: null,
  });
}

function fakeSubtitleSuccess() {
  return (options: { scenes: VideoScene[] }): SubtitleEngineResult => ({
    scenes: options.scenes.map((scene) => ({
      ...scene,
      subtitles: [{ index: 0, text: scene.narration, startSeconds: 0, endSeconds: scene.audio?.duration ?? 1 }],
    })),
    allReady: true,
    failedSceneIds: [],
  });
}

function fakeRenderSuccess() {
  return async (options: RenderEngineOptions): Promise<RenderEngineResult> => ({
    finalVideoPath: "/fake/storage/final.mp4",
    totalDurationSeconds: options.scenes.reduce((sum, scene) => sum + (scene.audio?.duration ?? 0), 0),
  });
}

function fakeValidateSuccess() {
  return async (_filePath: string, expectedDuration: number): Promise<VideoValidationResult> => ({
    valid: true,
    errors: [],
    metadata: {
      durationSeconds: expectedDuration,
      width: 1920,
      height: 1080,
      fps: 30,
      videoCodec: "h264",
      audioCodec: "aac",
      fileSizeBytes: 123456,
    },
  });
}

function fakeValidateFailure() {
  return async (): Promise<VideoValidationResult> => ({ valid: false, errors: ["fake validation failure"] });
}

describe("job state machine", () => {
  let dir: string;
  let repo: LocalJobRepository;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "vidpilot-test-"));
    repo = new LocalJobRepository(dir);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("goes QUEUED -> GENERATING_SCRIPT -> SCRIPT_READY on success", async () => {
    const service = createJobOrchestrator(repo, async () => fakeContent());
    const job = await service.createJob(BASE_INPUT);
    expect(job.status).toBe("queued");

    const updated = await service.processQueuedJob(job.id);
    expect(updated.status).toBe("script_ready");
    expect(updated.content?.title).toBe("Test Title");
    expect(updated.scriptProvider).toBe("gemini");
  });

  it("transitions to FAILED when generation throws", async () => {
    const service = createJobOrchestrator(repo, async () => {
      throw new AIGenerationError("all providers failed");
    });
    const job = await service.createJob(BASE_INPUT);

    await expect(service.processQueuedJob(job.id)).rejects.toThrow(HttpError);

    const failedJob = await service.getJobOrThrow(job.id);
    expect(failedJob.status).toBe("failed");
    expect(failedJob.lastError).toContain("all providers failed");
  });

  it("allows retry to move FAILED back to QUEUED", async () => {
    const service = createJobOrchestrator(repo, async () => {
      throw new AIGenerationError("boom");
    });
    const job = await service.createJob(BASE_INPUT);
    await expect(service.processQueuedJob(job.id)).rejects.toThrow();

    const retried = await service.retryJob(job.id);
    expect(retried.status).toBe("queued");
  });

  it("rejects generate-script on a non-queued job", async () => {
    const service = createJobOrchestrator(repo, async () => fakeContent());
    const job = await service.createJob(BASE_INPUT);
    await service.processQueuedJob(job.id); // now script_ready

    await expect(service.processQueuedJob(job.id)).rejects.toThrow(ValidationError);
  });

  it("allows regeneration of a script_ready job and increments retryCount", async () => {
    const service = createJobOrchestrator(repo, async () => fakeContent());
    const job = await service.createJob(BASE_INPUT);
    await service.processQueuedJob(job.id);

    const regenerated = await service.regenerateScript(job.id, "make it punchier");
    expect(regenerated.status).toBe("script_ready");
    expect(regenerated.retryCount).toBe(2);
  });

  it("rejects cancelling a job that is already published", async () => {
    const service = createJobOrchestrator(repo, async () => fakeContent());
    const job = await service.createJob(BASE_INPUT);
    await repo.updateJobStatus(job.id, "published");

    await expect(service.cancelJob(job.id)).rejects.toThrow(ValidationError);
  });
});

describe("voice generation state machine", () => {
  let dir: string;
  let repo: LocalJobRepository;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "vidpilot-voice-test-"));
    repo = new LocalJobRepository(dir);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("goes SCRIPT_READY -> GENERATING_VOICE -> VOICE_READY on success", async () => {
    const service = createJobOrchestrator(repo, async () => fakeContent(), fakeVoiceSuccess());
    const job = await service.createJob(BASE_INPUT);
    await service.processQueuedJob(job.id);

    const updated = await service.generateVoiceForJob(job.id);
    expect(updated.status).toBe("voice_ready");
    expect(updated.voiceGeneration?.status).toBe("ready");
    expect(updated.content?.scenes.every((scene) => scene.audio?.status === "ready")).toBe(true);
  });

  it("rejects generate-voice before a script exists", async () => {
    const service = createJobOrchestrator(repo, async () => fakeContent(), fakeVoiceSuccess());
    const job = await service.createJob(BASE_INPUT);

    await expect(service.generateVoiceForJob(job.id)).rejects.toThrow(ValidationError);
  });

  it("marks the job FAILED and reports per-scene detail when voice generation fails", async () => {
    // A scene-level failure resolves normally (not a thrown error) so the
    // caller gets back exactly which scenes failed vs. succeeded — see
    // runVoiceStage. Only an engine-level exception (voice/language totally
    // unavailable, unexpected crash) throws HttpError; see the next test.
    const service = createJobOrchestrator(repo, async () => fakeContent(), fakeVoiceFailure());
    const job = await service.createJob(BASE_INPUT);
    await service.processQueuedJob(job.id);

    const failed = await service.generateVoiceForJob(job.id);
    expect(failed.status).toBe("failed");
    expect(failed.voiceGeneration?.status).toBe("failed");
    expect(failed.content?.scenes[0].audio?.status).toBe("failed");
    expect(failed.lastError).toContain("1 of 1 scene(s)");
  });

  it("throws HttpError when the voice engine itself throws (e.g. unavailable voice/language)", async () => {
    const service = createJobOrchestrator(repo, async () => fakeContent(), async () => {
      throw new Error("voice unavailable for this language");
    });

    const job = await service.createJob(BASE_INPUT);
    await service.processQueuedJob(job.id);

    await expect(service.generateVoiceForJob(job.id)).rejects.toThrow(HttpError);

    const failed = await service.getJobOrThrow(job.id);
    expect(failed.status).toBe("failed");
    expect(failed.lastError).toContain("voice unavailable");
  });

    it("passes the previous spoken script and measured word budget when repairing duration",async()=>{
      const contexts:import("../ai/prompts.js").GenerationContext[]=[];
      const service=createJobOrchestrator(repo,async ctx=>{contexts.push(ctx);return fakeContent();});
      const job=await service.createJob(BASE_INPUT);await service.processQueuedJob(job.id);
      await service.regenerateScript(job.id,"Fit the measured duration",135);
      expect(contexts.at(-1)).toMatchObject({targetNarrationWords:135,inputScript:fakeContent().content.scenes.map(s=>s.narration).join("\n\n")});
    });

  it("allows regenerateVoiceForJob from VOICE_READY", async () => {
    const service = createJobOrchestrator(repo, async () => fakeContent(), fakeVoiceSuccess());
    const job = await service.createJob(BASE_INPUT);
    await service.processQueuedJob(job.id);
    await service.generateVoiceForJob(job.id);
    await repo.updateJob(job.id,{videoRender:{status:"ready"} as VideoJob["videoRender"],qualityReport:{status:"PASS"} as QualityReport});

    const regenerated = await service.regenerateVoiceForJob(job.id);
    expect(regenerated.status).toBe("voice_ready");
    expect(regenerated.videoRender).toBeNull();expect(regenerated.qualityReport).toBeNull();
  });

  it("does not touch the script when regenerating voice", async () => {
    const service = createJobOrchestrator(repo, async () => fakeContent(), fakeVoiceSuccess());
    const job = await service.createJob(BASE_INPUT);
    await service.processQueuedJob(job.id);
    const beforeVoice = await service.generateVoiceForJob(job.id);
    const afterRegen = await service.regenerateVoiceForJob(job.id);

    expect(afterRegen.content?.title).toBe(beforeVoice.content?.title);
    expect(afterRegen.scriptGeneratedAt).toBe(beforeVoice.scriptGeneratedAt);
  });

  it("rejects regenerating voice for an unknown scene id", async () => {
    const service = createJobOrchestrator(repo, async () => fakeContent(), fakeVoiceSuccess());
    const job = await service.createJob(BASE_INPUT);
    await service.processQueuedJob(job.id);
    await service.generateVoiceForJob(job.id);

    await expect(service.regenerateVoiceForScene(job.id, "not-a-real-scene")).rejects.toThrow(NotFoundError);
  });
});

describe("video rendering state machine", () => {
  let dir: string;
  let repo: LocalJobRepository;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "vidpilot-render-test-"));
    repo = new LocalJobRepository(dir);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  async function makeVoiceReadyJob(service: ReturnType<typeof createJobOrchestrator>): Promise<VideoJob> {
    const job = await service.createJob(BASE_INPUT);
    await service.processQueuedJob(job.id);
    return service.generateVoiceForJob(job.id);
  }

  it("goes VOICE_READY -> ... -> VIDEO_READY on success", async () => {
    const service = createJobOrchestrator(
      repo,
      async () => fakeContent(),
      fakeVoiceSuccess(),
      fakeVisualSuccess(),
      fakeSubtitleSuccess(),
      fakeRenderSuccess(),
      fakeValidateSuccess()
    );
    await makeVoiceReadyJob(service);
    const job = (await repo.listJobs())[0];

    const updated = await service.renderVideoForJob(job.id);
    expect(updated.status).toBe("video_ready");
    expect(updated.renderTemplate).toBe("documentary");
    expect(updated.videoRender?.status).toBe("ready");
    expect(updated.videoRender?.path).toBe("/fake/storage/final.mp4");
    expect(updated.videoRender?.videoCodec).toBe("h264");
  });

  it("rejects render-video before voice is ready", async () => {
    const service = createJobOrchestrator(
      repo,
      async () => fakeContent(),
      fakeVoiceSuccess(),
      fakeVisualSuccess(),
      fakeSubtitleSuccess(),
      fakeRenderSuccess(),
      fakeValidateSuccess()
    );
    const job = await service.createJob(BASE_INPUT);
    await service.processQueuedJob(job.id); // script_ready, not voice_ready

    await expect(service.renderVideoForJob(job.id)).rejects.toThrow(ValidationError);
  });

  it("marks the job FAILED when visual generation fails, without calling render", async () => {
    let renderCalled = false;
    const service = createJobOrchestrator(
      repo,
      async () => fakeContent(),
      fakeVoiceSuccess(),
      fakeVisualFailure(),
      fakeSubtitleSuccess(),
      async (options) => {
        renderCalled = true;
        return fakeRenderSuccess()(options);
      },
      fakeValidateSuccess()
    );
    await makeVoiceReadyJob(service);
    const job = (await repo.listJobs())[0];

    const failed = await service.renderVideoForJob(job.id);
    expect(failed.status).toBe("failed");
    expect(failed.lastError).toContain("Visual generation failed");
    expect(renderCalled).toBe(false);
  });

  it("marks the job FAILED and records the reason when video validation fails", async () => {
    const service = createJobOrchestrator(
      repo,
      async () => fakeContent(),
      fakeVoiceSuccess(),
      fakeVisualSuccess(),
      fakeSubtitleSuccess(),
      fakeRenderSuccess(),
      fakeValidateFailure()
    );
    await makeVoiceReadyJob(service);
    const job = (await repo.listJobs())[0];

    const failed = await service.renderVideoForJob(job.id);
    expect(failed.status).toBe("failed");
    expect(failed.videoRender?.status).toBe("failed");
    expect(failed.videoRender?.error).toContain("fake validation failure");
    expect(failed.lastError).toContain("fake validation failure");
  });

  it("does not touch the script or voice record when retrying a failed render", async () => {
    let validateCallCount = 0;
    const service = createJobOrchestrator(
      repo,
      async () => fakeContent(),
      fakeVoiceSuccess(),
      fakeVisualSuccess(),
      fakeSubtitleSuccess(),
      fakeRenderSuccess(),
      async (filePath, expectedDuration) => {
        validateCallCount += 1;
        return validateCallCount === 1 ? fakeValidateFailure()() : fakeValidateSuccess()(filePath, expectedDuration);
      }
    );
    const ready = await makeVoiceReadyJob(service);

    const firstAttempt = await service.renderVideoForJob(ready.id);
    expect(firstAttempt.status).toBe("failed");

    const retried = await service.renderVideoForJob(ready.id);
    expect(retried.status).toBe("video_ready");
    expect(retried.scriptGeneratedAt).toBe(ready.scriptGeneratedAt);
    expect(retried.voiceGeneration?.generatedAt).toBe(ready.voiceGeneration?.generatedAt);
  });

  it("throws HttpError and records the failure when rendering itself throws", async () => {
    const service = createJobOrchestrator(
      repo,
      async () => fakeContent(),
      fakeVoiceSuccess(),
      fakeVisualSuccess(),
      fakeSubtitleSuccess(),
      async () => {
        throw new Error("ffmpeg exploded");
      },
      fakeValidateSuccess()
    );
    await makeVoiceReadyJob(service);
    const job = (await repo.listJobs())[0];

    await expect(service.renderVideoForJob(job.id)).rejects.toThrow(HttpError);

    const failed = await service.getJobOrThrow(job.id);
    expect(failed.status).toBe("failed");
    expect(failed.videoRender?.status).toBe("failed");
    expect(failed.lastError).toContain("ffmpeg exploded");
  });
});

describe("Phase 5 upgrade: regenerateVisualsForScene", () => {
  let dir: string;
  let repo: LocalJobRepository;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "vidpilot-visual-regen-test-"));
    repo = new LocalJobRepository(dir);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  async function makeVideoReadyJob(service: ReturnType<typeof createJobOrchestrator>): Promise<VideoJob> {
    const job = await service.createJob(BASE_INPUT);
    await service.processQueuedJob(job.id);
    await service.generateVoiceForJob(job.id);
    return service.renderVideoForJob(job.id);
  }

  it("re-sources one scene's visual and moves VIDEO_READY back to VOICE_READY", async () => {
    const service = createJobOrchestrator(
      repo,
      async () => fakeContent(),
      fakeVoiceSuccess(),
      fakeVisualSuccess(),
      fakeSubtitleSuccess(),
      fakeRenderSuccess(),
      fakeValidateSuccess()
    );
    const ready = await makeVideoReadyJob(service);
    expect(ready.status).toBe("video_ready");

    const regenerated = await service.regenerateVisualsForScene(ready.id, "s1");
    expect(regenerated.status).toBe("voice_ready");
    expect(regenerated.content?.scenes[0].visual?.status).toBe("ready");
  });

  it("does not touch the script or voice record when regenerating one scene's visual", async () => {
    const service = createJobOrchestrator(
      repo,
      async () => fakeContent(),
      fakeVoiceSuccess(),
      fakeVisualSuccess(),
      fakeSubtitleSuccess(),
      fakeRenderSuccess(),
      fakeValidateSuccess()
    );
    const ready = await makeVideoReadyJob(service);

    const regenerated = await service.regenerateVisualsForScene(ready.id, "s1");
    expect(regenerated.scriptGeneratedAt).toBe(ready.scriptGeneratedAt);
    expect(regenerated.voiceGeneration?.generatedAt).toBe(ready.voiceGeneration?.generatedAt);
  });

  it("rejects regenerating visuals for an unknown scene id", async () => {
    const service = createJobOrchestrator(
      repo,
      async () => fakeContent(),
      fakeVoiceSuccess(),
      fakeVisualSuccess(),
      fakeSubtitleSuccess(),
      fakeRenderSuccess(),
      fakeValidateSuccess()
    );
    const ready = await makeVideoReadyJob(service);

    await expect(service.regenerateVisualsForScene(ready.id, "not-a-real-scene")).rejects.toThrow(NotFoundError);
  });

  it("rejects regenerating visuals before voice is ready", async () => {
    const service = createJobOrchestrator(repo, async () => fakeContent(), fakeVoiceSuccess(), fakeVisualSuccess());
    const job = await service.createJob(BASE_INPUT);
    await service.processQueuedJob(job.id); // script_ready, not voice_ready

    await expect(service.regenerateVisualsForScene(job.id, "s1")).rejects.toThrow(ValidationError);
  });

  it("marks the job FAILED when the targeted scene's visual regeneration fails", async () => {
    const service = createJobOrchestrator(
      repo,
      async () => fakeContent(),
      fakeVoiceSuccess(),
      fakeVisualSuccess(),
      fakeSubtitleSuccess(),
      fakeRenderSuccess(),
      fakeValidateSuccess()
    );
    const ready = await makeVideoReadyJob(service);

    const failingService = createJobOrchestrator(
      repo,
      async () => fakeContent(),
      fakeVoiceSuccess(),
      fakeVisualFailure(),
      fakeSubtitleSuccess(),
      fakeRenderSuccess(),
      fakeValidateSuccess()
    );
    const failed = await failingService.regenerateVisualsForScene(ready.id, "s1");
    expect(failed.status).toBe("failed");
    expect(failed.content?.scenes[0].visual?.status).toBe("failed");
  });
});

class FakeYouTubeProvider implements YouTubeProvider {
  configured = true;
  connected = true;
  uploadError: Error | null = null;
  uploadCalls: { filePath: string; metadata: YouTubeUploadMetadata }[] = [];

  isConfigured(): boolean {
    return this.configured;
  }
  async isConnected(): Promise<boolean> {
    return this.connected;
  }
  getAuthUrl(): string {
    return "https://accounts.google.com/fake-consent";
  }
  async handleCallback() {
    return { id: "channel-1", title: "Fake Channel", thumbnailUrl: null };
  }
  async getChannelInfo() {
    return this.connected ? { id: "channel-1", title: "Fake Channel", thumbnailUrl: null } : null;
  }
  async disconnect(): Promise<void> {
    this.connected = false;
  }
  async uploadVideo(input: { filePath: string; metadata: YouTubeUploadMetadata }) {
    this.uploadCalls.push(input);
    if (this.uploadError) throw this.uploadError;
    return { videoId: "fake-video-id" };
  }
}

function fakeQualityReport(status: "PASS" | "WARN" | "FAIL" = "PASS"): QualityReport {
  const result = { status: "PASS" as const, details: {}, issues: [] };
  return {
    jobId: "fake",
    status,
    score: status === "PASS" ? 100 : 40,
    checkedAt: new Date().toISOString(),
    video: result,
    audio: result,
    captions: result,
    visuals: result,
    sync: result,
    metadata: result,
    content: result,
    license: result,
    warnings: [],
    failures: [],
  };
}

function fakeValidateAlwaysValid() {
  return async (): Promise<VideoValidationResult> => ({
    valid: true,
    errors: [],
    metadata: {
      durationSeconds: 30,
      width: 1080,
      height: 1920,
      fps: 30,
      videoCodec: "h264",
      audioCodec: "aac",
      fileSizeBytes: 5_000_000,
    },
  });
}

describe("Phase 11: YouTube upload state machine", () => {
  let dir: string;
  let repo: LocalJobRepository;
  let youtube: FakeYouTubeProvider;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "vidpilot-youtube-test-"));
    repo = new LocalJobRepository(dir);
    youtube = new FakeYouTubeProvider();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function makeService(validateVideo = fakeValidateAlwaysValid()) {
    return createJobOrchestrator(repo, undefined, undefined, undefined, undefined, undefined, validateVideo, undefined, youtube, new RuntimeState(path.join(dir,"state")));
  }

  /** Fabricates a job already approved for its current render, with a PASS quality report — upload logic only cares about these durable records, same convention as Phase 10's makeReadyJob. */
  async function makeQcPassedJob(overrides: Partial<VideoJob> = {}): Promise<VideoJob> {
    const created = await repo.createJob(BASE_INPUT);
    return repo.updateJob(created.id, {
      status: "qc_passed",
      renderVersion: 1,
      videoRender: {
        status: "ready",
        generatedAt: new Date().toISOString(),
        durationSeconds: 30,
        width: 1080,
        height: 1920,
        fps: 30,
        videoCodec: "h264",
        audioCodec: "aac",
        fileSizeBytes: 5_000_000,
        path: "/fake/storage/final.mp4",
        error: null,
      },
      qualityReport: fakeQualityReport("PASS"),
      content: {
        title: "Test Title",
        hook: "hook",
        introduction: "intro",
        scenes: [],
        conclusion: "conclusion",
        description: "description",
        tags: ["tag1"],
        estimatedDuration: 30,
      },
      ...overrides,
    });
  }

  it("uploads successfully after QC PASS, and connected", async () => {
    const service = makeService();
    const job = await makeQcPassedJob();

    const published = await service.uploadVideoForJob(job.id);

    expect(published.status).toBe("published");
    expect(published.youtube?.status).toBe("uploaded");
    expect(published.youtube?.videoId).toBe("fake-video-id");
    expect(published.youtube?.url).toContain("fake-video-id");
    expect(published.youtubeVideoId).toBe("fake-video-id");
    expect(published.publishedAt).not.toBeNull();
    expect(youtube.uploadCalls).toHaveLength(1);
    expect(youtube.uploadCalls[0].filePath).toBe("/fake/storage/final.mp4");
  });



  it("rejects upload when the quality report is not a PASS", async () => {
    const service = makeService();
    const job = await makeQcPassedJob({ qualityReport: fakeQualityReport("WARN") });

    await expect(service.uploadVideoForJob(job.id)).rejects.toThrow(ValidationError);
    expect(youtube.uploadCalls).toHaveLength(0);
  });

  it("rejects upload when there is no ready rendered video", async () => {
    const service = makeService();
    const job = await makeQcPassedJob({
      videoRender: {
        status: "failed",
        generatedAt: null,
        durationSeconds: null,
        width: null,
        height: null,
        fps: null,
        videoCodec: null,
        audioCodec: null,
        fileSizeBytes: null,
        path: null,
        error: "boom",
      },
    });

    await expect(service.uploadVideoForJob(job.id)).rejects.toThrow(ValidationError);
    expect(youtube.uploadCalls).toHaveLength(0);
  });

  it("rejects upload when YouTube is not connected", async () => {
    youtube.connected = false;
    const service = makeService();
    const job = await makeQcPassedJob();

    await expect(service.uploadVideoForJob(job.id)).rejects.toThrow(ValidationError);
    expect(youtube.uploadCalls).toHaveLength(0);
  });

  it("rejects upload when YouTube is not configured at all", async () => {
    youtube.configured = false;
    const service = makeService();
    const job = await makeQcPassedJob();

    await expect(service.uploadVideoForJob(job.id)).rejects.toThrow(ValidationError);
    expect(youtube.uploadCalls).toHaveLength(0);
  });

  it("refuses to upload a job that was already published (idempotency / duplicate protection)", async () => {
    const service = makeService();
    const job = await makeQcPassedJob();
    const published = await service.uploadVideoForJob(job.id);
    expect(published.youtube?.videoId).toBe("fake-video-id");

    await expect(service.uploadVideoForJob(job.id)).rejects.toThrow(ValidationError);
    // Only the first call actually reached the provider.
    expect(youtube.uploadCalls).toHaveLength(1);
  });

  it("re-validates the actual rendered file before uploading, never trusting stored metadata alone", async () => {
    const service = makeService(async () => ({ valid: false, errors: ["file is corrupt"] }));
    const job = await makeQcPassedJob();

    await expect(service.uploadVideoForJob(job.id)).rejects.toThrow(HttpError);
    expect(youtube.uploadCalls).toHaveLength(0);

    const failed = await service.getJobOrThrow(job.id);
    expect(failed.status).toBe("failed");
    expect(failed.youtube?.status).toBe("failed");
    expect(failed.lastError).toContain("corrupt");
  });

  it("marks the job FAILED and records the real error when the provider throws", async () => {
    youtube.uploadError = new Error("quota exceeded");
    const service = makeService();
    const job = await makeQcPassedJob();

    await expect(service.uploadVideoForJob(job.id)).rejects.toThrow(HttpError);

    const failed = await service.getJobOrThrow(job.id);
    expect(failed.status).toBe("failed");
    expect(failed.youtube?.status).toBe("uncertain");
    expect(failed.youtube?.lastError).toContain("quota exceeded");
    await expect(service.uploadVideoForJob(job.id)).rejects.toThrow(/already started/);
    expect(youtube.uploadCalls).toHaveLength(1);
  });
  it("permits a safe retry after a definitive OAuth rejection",async()=>{
    youtube.uploadError=new YouTubeApiError("Reconnect YouTube","invalid_grant");const service=makeService();const job=await makeQcPassedJob();
    await expect(service.uploadVideoForJob(job.id)).rejects.toThrow("Reconnect YouTube");
    expect((await service.getJobOrThrow(job.id)).youtube?.status).toBe("failed");
    youtube.uploadError=null;expect((await service.uploadVideoForJob(job.id)).status).toBe("published");
  });


  it("never gets to the provider call at all when a precondition fails", async () => {
    const service = makeService();
    const job = await makeQcPassedJob({ status: "video_validation" }); // not an UPLOAD_READY_STATUS

    await expect(service.uploadVideoForJob(job.id)).rejects.toThrow(ValidationError);
    expect(youtube.uploadCalls).toHaveLength(0);
  });
});

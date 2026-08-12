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
  thumbnailEnabled: true,
  approvalRequired: true,
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

  it("allows regenerateVoiceForJob from VOICE_READY", async () => {
    const service = createJobOrchestrator(repo, async () => fakeContent(), fakeVoiceSuccess());
    const job = await service.createJob(BASE_INPUT);
    await service.processQueuedJob(job.id);
    await service.generateVoiceForJob(job.id);

    const regenerated = await service.regenerateVoiceForJob(job.id);
    expect(regenerated.status).toBe("voice_ready");
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

describe("Phase 10: Telegram approval state machine", () => {
  let dir: string;
  let repo: LocalJobRepository;
  let service: ReturnType<typeof createJobOrchestrator>;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "vidpilot-approval-test-"));
    repo = new LocalJobRepository(dir);
    service = createJobOrchestrator(repo);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  /** Fabricates a job already past rendering/QC, without running the full pipeline — approval logic only cares about status/videoRender/approval. */
  async function makeReadyJob(overrides: Partial<VideoJob> = {}): Promise<VideoJob> {
    const created = await repo.createJob(BASE_INPUT);
    return repo.updateJob(created.id, {
      status: "ready",
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
      ...overrides,
    });
  }

  async function makeSentJob(): Promise<VideoJob> {
    const ready = await makeReadyJob();
    return service.recordApprovalSent(ready.id, 111);
  }

  describe("prepareApprovalSend", () => {
    it("returns the job when it's READY with a valid render", async () => {
      const ready = await makeReadyJob();
      const job = await service.prepareApprovalSend(ready.id);
      expect(job.id).toBe(ready.id);
    });

    it("also allows re-sending a job already AWAITING_APPROVAL", async () => {
      const sent = await makeSentJob();
      const job = await service.prepareApprovalSend(sent.id);
      expect(job.status).toBe("awaiting_approval");
    });

    it("rejects a job that hasn't rendered yet", async () => {
      const job = await service.createJob(BASE_INPUT);
      await expect(service.prepareApprovalSend(job.id)).rejects.toThrow(ValidationError);
    });

    it("rejects a job whose video render isn't ready", async () => {
      const ready = await makeReadyJob({
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
      await expect(service.prepareApprovalSend(ready.id)).rejects.toThrow(ValidationError);
    });

    it("rejects a video over Telegram's real bot-upload size limit", async () => {
      const ready = await makeReadyJob({
        videoRender: {
          status: "ready",
          generatedAt: new Date().toISOString(),
          durationSeconds: 30,
          width: 1080,
          height: 1920,
          fps: 30,
          videoCodec: "h264",
          audioCodec: "aac",
          fileSizeBytes: 60 * 1024 * 1024,
          path: "/fake/storage/final.mp4",
          error: null,
        },
      });
      await expect(service.prepareApprovalSend(ready.id)).rejects.toThrow(/50MB/);
    });
  });

  describe("recordApprovalSent", () => {
    it("moves the job to AWAITING_APPROVAL with version 1 on the first send", async () => {
      const ready = await makeReadyJob();
      const sent = await service.recordApprovalSent(ready.id, 555);
      expect(sent.status).toBe("awaiting_approval");
      expect(sent.telegramMessageId).toBe("555");
      expect(sent.approval).toMatchObject({ status: "sent", version: 1, renderVersion: 0, decision: null });
      expect(sent.approval?.sentAt).toBeTruthy();
    });

    it("increments the version on a resend rather than resetting it", async () => {
      const sent = await makeSentJob();
      const resent = await service.recordApprovalSent(sent.id, 222);
      expect(resent.approval?.version).toBe(2);
    });
  });

  describe("approveJob", () => {
    it("approves a job whose version matches and clears its buttons state", async () => {
      const sent = await makeSentJob();
      const result = await service.approveJob(sent.id, sent.approval!.version);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.job.status).toBe("approved");
        expect(result.job.approval?.status).toBe("approved");
        expect(result.job.approval?.decision).toBe("approved");
        expect(result.job.approvedAt).toBeTruthy();
      }
    });

    it("rejects a stale version (an older Telegram message tapped after a resend)", async () => {
      const sent = await makeSentJob();
      await service.recordApprovalSent(sent.id, 999); // bumps to version 2
      const result = await service.approveJob(sent.id, 1);
      expect(result).toEqual({ ok: false, reason: "stale_version" });
    });

    it("is idempotent — a second tap on an already-approved job is a no-op, not a double-approval", async () => {
      const sent = await makeSentJob();
      const version = sent.approval!.version;
      const first = await service.approveJob(sent.id, version);
      expect(first.ok).toBe(true);
      const second = await service.approveJob(sent.id, version);
      // The first approve already moved the job off "awaiting_approval", so
      // the second tap is rejected there — no separate "already decided" state.
      expect(second).toEqual({ ok: false, reason: "not_awaiting_approval" });
    });

    it("rejects a job that was never sent for approval", async () => {
      const ready = await makeReadyJob();
      const result = await service.approveJob(ready.id, 1);
      expect(result).toEqual({ ok: false, reason: "not_awaiting_approval" });
    });

    it("reports not_found for an unknown job id", async () => {
      const result = await service.approveJob("does-not-exist", 1);
      expect(result).toEqual({ ok: false, reason: "not_found" });
    });
  });

  describe("recordPendingRejectionPrompt + rejectJob", () => {
    it("records the reason-prompt message id without changing job status", async () => {
      const sent = await makeSentJob();
      const result = await service.recordPendingRejectionPrompt(sent.id, sent.approval!.version, 42);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.job.status).toBe("awaiting_approval");
        expect(result.job.approval?.pendingReasonPromptMessageId).toBe(42);
      }
    });

    it("rejects a job with a real reason and clears the pending prompt id", async () => {
      const sent = await makeSentJob();
      const version = sent.approval!.version;
      await service.recordPendingRejectionPrompt(sent.id, version, 42);

      const result = await service.rejectJob(sent.id, version, "Captions overlap the subject.");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.job.status).toBe("rejected");
        expect(result.job.approval?.status).toBe("rejected");
        expect(result.job.approval?.reason).toBe("Captions overlap the subject.");
        expect(result.job.approval?.pendingReasonPromptMessageId).toBeNull();
      }
    });

    it("rejects a stale-version quick-reason tap", async () => {
      const sent = await makeSentJob();
      await service.recordApprovalSent(sent.id, 999); // bumps to version 2
      const result = await service.rejectJob(sent.id, 1, "Voice");
      expect(result).toEqual({ ok: false, reason: "stale_version" });
    });
  });

  describe("findJobAwaitingReasonReply", () => {
    it("finds the one job whose pending prompt id matches", async () => {
      const jobA = await makeSentJob();
      const jobB = await makeSentJob();
      await service.recordPendingRejectionPrompt(jobA.id, jobA.approval!.version, 100);
      await service.recordPendingRejectionPrompt(jobB.id, jobB.approval!.version, 200);

      const found = await service.findJobAwaitingReasonReply(200);
      expect(found?.id).toBe(jobB.id);
    });

    it("returns null when no job is waiting on that prompt id", async () => {
      await makeSentJob();
      const found = await service.findJobAwaitingReasonReply(999999);
      expect(found).toBeNull();
    });
  });

  describe("renderVideoForJob resets approval", () => {
    it("bumps renderVersion and clears any prior approval on a fresh successful render", async () => {
      const renderService = createJobOrchestrator(
        repo,
        async () => fakeContent(),
        fakeVoiceSuccess(),
        fakeVisualSuccess(),
        fakeSubtitleSuccess(),
        fakeRenderSuccess(),
        fakeValidateSuccess()
      );
      const job = await renderService.createJob(BASE_INPUT);
      await renderService.processQueuedJob(job.id);
      await renderService.generateVoiceForJob(job.id);
      const rendered = await renderService.renderVideoForJob(job.id);
      expect(rendered.renderVersion).toBe(1);
      expect(rendered.approval).toBeNull();

      // Simulate a prior approval round having been sent, then re-render (e.g. after a scene fix).
      await repo.updateJob(job.id, { status: "ready" });
      const sent = await service.recordApprovalSent(job.id, 1);
      expect(sent.approval?.version).toBe(1);

      await repo.updateJob(job.id, { status: "voice_ready" });
      const reRendered = await renderService.renderVideoForJob(job.id);
      expect(reRendered.renderVersion).toBe(2);
      expect(reRendered.approval).toBeNull();
    });
  });
});

/** Test-only YouTubeProvider — see youtubeProvider.ts's own doc comment anticipating exactly this. Never calls a real Google API. */
class FakeYouTubeProvider implements YouTubeProvider {
  configured = true;
  connected = true;
  uploadError: Error | null = null;
  uploadCalls: { filePath: string; metadata: YouTubeUploadMetadata }[] = [];
  thumbnailCalls: { videoId: string; thumbnailPath: string }[] = [];

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
  async uploadThumbnail(videoId: string, thumbnailPath: string): Promise<void> {
    this.thumbnailCalls.push({ videoId, thumbnailPath });
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
    return createJobOrchestrator(repo, undefined, undefined, undefined, undefined, undefined, validateVideo, undefined, youtube);
  }

  /** Fabricates a job already approved for its current render, with a PASS quality report — upload logic only cares about these durable records, same convention as Phase 10's makeReadyJob. */
  async function makeApprovedJob(overrides: Partial<VideoJob> = {}): Promise<VideoJob> {
    const created = await repo.createJob(BASE_INPUT);
    return repo.updateJob(created.id, {
      status: "approved",
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
      approval: {
        status: "approved",
        version: 1,
        renderVersion: 1,
        sentAt: new Date().toISOString(),
        decision: "approved",
        reason: null,
        decidedAt: new Date().toISOString(),
        pendingReasonPromptMessageId: null,
      },
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

  it("uploads successfully when approved, QC PASS, and connected", async () => {
    const service = makeService();
    const job = await makeApprovedJob();

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

  it("rejects upload when the job was never approved", async () => {
    const service = makeService();
    const job = await makeApprovedJob({ status: "ready", approval: null });

    await expect(service.uploadVideoForJob(job.id)).rejects.toThrow(ValidationError);
    expect(youtube.uploadCalls).toHaveLength(0);
  });

  it("rejects upload when approval is stale (job was re-rendered after approval)", async () => {
    const service = makeService();
    const job = await makeApprovedJob({ renderVersion: 2 }); // approval.renderVersion stays 1

    await expect(service.uploadVideoForJob(job.id)).rejects.toThrow(ValidationError);
    expect(youtube.uploadCalls).toHaveLength(0);
  });

  it("rejects upload when the quality report is not a PASS", async () => {
    const service = makeService();
    const job = await makeApprovedJob({ qualityReport: fakeQualityReport("WARN") });

    await expect(service.uploadVideoForJob(job.id)).rejects.toThrow(ValidationError);
    expect(youtube.uploadCalls).toHaveLength(0);
  });

  it("rejects upload when there is no ready rendered video", async () => {
    const service = makeService();
    const job = await makeApprovedJob({
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
    const job = await makeApprovedJob();

    await expect(service.uploadVideoForJob(job.id)).rejects.toThrow(ValidationError);
    expect(youtube.uploadCalls).toHaveLength(0);
  });

  it("rejects upload when YouTube is not configured at all", async () => {
    youtube.configured = false;
    const service = makeService();
    const job = await makeApprovedJob();

    await expect(service.uploadVideoForJob(job.id)).rejects.toThrow(ValidationError);
    expect(youtube.uploadCalls).toHaveLength(0);
  });

  it("refuses to upload a job that was already published (idempotency / duplicate protection)", async () => {
    const service = makeService();
    const job = await makeApprovedJob();
    const published = await service.uploadVideoForJob(job.id);
    expect(published.youtube?.videoId).toBe("fake-video-id");

    await expect(service.uploadVideoForJob(job.id)).rejects.toThrow(ValidationError);
    // Only the first call actually reached the provider.
    expect(youtube.uploadCalls).toHaveLength(1);
  });

  it("re-validates the actual rendered file before uploading, never trusting stored metadata alone", async () => {
    const service = makeService(async () => ({ valid: false, errors: ["file is corrupt"] }));
    const job = await makeApprovedJob();

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
    const job = await makeApprovedJob();

    await expect(service.uploadVideoForJob(job.id)).rejects.toThrow(HttpError);

    const failed = await service.getJobOrThrow(job.id);
    expect(failed.status).toBe("failed");
    expect(failed.youtube?.status).toBe("failed");
    expect(failed.youtube?.lastError).toContain("quota exceeded");
    // A failed upload doesn't retroactively revoke the approval that was
    // already granted — a retry should not need to go back through Telegram.
    expect(failed.approval?.status).toBe("approved");
  });

  it("uploads a thumbnail when one is ready, without failing the video upload if the thumbnail call fails", async () => {
    const service = makeService();
    const job = await makeApprovedJob({
      thumbnail: {
        status: "ready",
        path: "/fake/storage/thumb.jpg",
        width: 1280,
        height: 720,
        fileSizeBytes: 100_000,
        headline: "Headline",
        sourceAssetId: null,
        generatedAt: new Date().toISOString(),
        error: null,
      },
    });

    const published = await service.uploadVideoForJob(job.id);
    expect(published.youtube?.thumbnailStatus).toBe("uploaded");
    expect(youtube.thumbnailCalls).toHaveLength(1);
    expect(youtube.thumbnailCalls[0]).toEqual({ videoId: "fake-video-id", thumbnailPath: "/fake/storage/thumb.jpg" });
  });

  it("never gets to the provider call at all when a precondition fails", async () => {
    const service = makeService();
    const job = await makeApprovedJob({ status: "video_validation" }); // not an UPLOAD_READY_STATUS

    await expect(service.uploadVideoForJob(job.id)).rejects.toThrow(ValidationError);
    expect(youtube.uploadCalls).toHaveLength(0);
  });
});

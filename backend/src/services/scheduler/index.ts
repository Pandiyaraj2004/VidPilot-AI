import { SchedulerConfigRepository } from "./schedulerConfigRepository.js";
import { AutomationHistory } from "./automationHistory.js";
import { SchedulerLock } from "./schedulerLock.js";
import { selectNextVariation } from "./variationEngine.js";
import { createJob, processQueuedJob, generateVoiceForJob, renderVideoForJob, runQualityCheckForJob } from "../jobs/jobService.js";
import { sendApprovalRequestForJob } from "../telegram/sendApproval.js";
import type { SchedulerConfig } from "../../types/index.js";

let checkInterval: NodeJS.Timeout | null = null;
let runningPipeline = false;

export class SchedulerService {
  public readonly configRepo = new SchedulerConfigRepository();
  public readonly history = new AutomationHistory();
  public readonly lock = new SchedulerLock();

  async getConfig(): Promise<SchedulerConfig> {
    return this.configRepo.get();
  }

  async updateConfig(newConfig: Partial<SchedulerConfig>): Promise<SchedulerConfig> {
    const current = await this.configRepo.get();
    const merged = { ...current, ...newConfig };
    
    // Recalculate nextGenerationAt if enabling or interval changed
    if (merged.automationEnabled && (!current.automationEnabled || current.intervalHours !== merged.intervalHours)) {
      const now = new Date();
      merged.nextGenerationAt = new Date(now.getTime() + merged.intervalHours * 60 * 60 * 1000).toISOString();
      await this.history.record({
        eventType: "scheduler_recalculated",
        message: `Schedule recalculated: next run scheduled at ${merged.nextGenerationAt}`,
      });
    } else if (!merged.automationEnabled) {
      merged.nextGenerationAt = null;
    }

    const saved = await this.configRepo.set(merged);
    
    if (saved.automationEnabled) {
      this.startLoop();
    } else {
      this.stopLoop();
    }

    return saved;
  }

  startLoop(): void {
    if (checkInterval) return;
    console.log("[Scheduler] Starting elapsed-time checker tick loop (every 30s)...");
    
    // Perform check immediately, then every 30s
    void this.tick();
    checkInterval = setInterval(() => {
      void this.tick();
    }, 30000);
    
    void this.history.record({
      eventType: "scheduler_started",
      message: "Scheduler service tick loop initiated.",
    });
  }

  stopLoop(): void {
    if (checkInterval) {
      clearInterval(checkInterval);
      checkInterval = null;
      console.log("[Scheduler] Stopped elapsed-time checker tick loop.");
    }
  }

  async triggerIfDue(): Promise<boolean> {
    const config = await this.configRepo.get();
    if (!config.automationEnabled || !config.nextGenerationAt) return false;

    const now = new Date();
    const nextRun = new Date(config.nextGenerationAt);

    if (now >= nextRun) {
      // Prevent duplicate generation slots across concurrent processes
      const slotTimeKey = nextRun.toISOString();
      const acquired = await this.lock.acquire(slotTimeKey);
      if (!acquired) {
        console.warn(`[Scheduler] Skipping slot ${slotTimeKey} — already locked/processed.`);
        return false;
      }

      console.log(`[Scheduler] Generation slot ${slotTimeKey} reached!`);
      
      // Compute next slot immediately (prevent drift: anchor on previous nextGenerationAt)
      const nextSlot = new Date(nextRun.getTime() + config.intervalHours * 60 * 60 * 1000).toISOString();
      await this.configRepo.set({
        ...config,
        lastGenerationAt: now.toISOString(),
        nextGenerationAt: nextSlot,
      });

      // Run generation pipeline asynchronously in background (don't block the tick loop)
      void this.runPipeline();
      return true;
    }

    return false;
  }

  async runPipeline(): Promise<void> {
    let jobId: string | undefined;

    try {
      const config = await this.configRepo.get();
      const records = await this.history.read();

      // 1. Select Variation parameters
      const selection = selectNextVariation(
        config.contentCategories,
        config.languages,
        config.enabledVoices,
        records,
        config.minDurationSeconds,
        config.maxDurationSeconds,
        config.defaultStyle
      );

      console.log(`[Scheduler] Variation selected: Topic="${selection.topic}", Language=${selection.language}, Voice=${selection.voiceId}, Duration=${selection.durationSeconds}s`);

      // 2. Create Video Job
      const job = await createJob({
        topic: selection.topic,
        style: selection.style,
        contentCategory: selection.category,
        durationSeconds: selection.durationSeconds,
        language: selection.language,
        voiceId: selection.voiceId,
        voiceSpeed: 1.0,
        visualStyle: "cinematic",
        subtitlesEnabled: true,
        thumbnailEnabled: false,
        approvalRequired: config.requireApproval,
        youtubeVisibility: config.youtubeVisibility,
        source: "scheduled",
      });

      jobId = job.id;
      await this.configRepo.set({ ...config, lastJobId: jobId });

      await this.history.record({
        eventType: "job_created",
        jobId,
        topic: selection.topic,
        category: selection.category,
        language: selection.language,
        voice: selection.voiceId,
        storyStructure: selection.storyStructure,
        hookType: selection.hookType,
        targetDuration: selection.durationSeconds,
        message: `Successfully created scheduled production job ${jobId}.`,
      });

      // 3. Generate AI Script
      console.log(`[Scheduler] Generating script for job ${jobId}...`);
      const scriptJob = await processQueuedJob(jobId);
      
      // Inject AI chosen structural choices for anti-repetition memory
      const contentPatch = {
        title: scriptJob.content?.title || "",
        hook: scriptJob.content?.hook || "",
        introduction: scriptJob.content?.introduction || "",
        scenes: scriptJob.content?.scenes || [],
        conclusion: scriptJob.content?.conclusion || "",
        description: scriptJob.content?.description || "",
        tags: scriptJob.content?.tags || [],
        estimatedDuration: scriptJob.content?.estimatedDuration || 0,
        storyStructure: selection.storyStructure,
        hookType: selection.hookType,
        ctaPattern: selection.ctaPattern,
      };
      
      const { jobRepository } = await import("../jobs/index.js");
      await jobRepository.updateJob(jobId, { content: contentPatch });

      // 4. Generate Voice
      console.log(`[Scheduler] Generating voice narration for job ${jobId}...`);
      await generateVoiceForJob(jobId);

      // 5. Render Video (Remotion + FFmpeg Concat)
      console.log(`[Scheduler] Sourcing visuals & rendering composition for job ${jobId}...`);
      await renderVideoForJob(jobId);

      // 6. Quality Control Check
      console.log(`[Scheduler] Running Quality Control validators for job ${jobId}...`);
      const qcJob = await runQualityCheckForJob(jobId);

      // 7. Send Telegram Approval
      console.log(`[Scheduler] Sending video approval request to Telegram for job ${jobId}...`);
      await sendApprovalRequestForJob(jobId);

      await this.history.record({
        eventType: "awaiting_approval",
        jobId,
        topic: selection.topic,
        category: selection.category,
        language: selection.language,
        voice: selection.voiceId,
        storyStructure: selection.storyStructure,
        hookType: selection.hookType,
        targetDuration: selection.durationSeconds,
        actualDuration: qcJob.videoRender?.durationSeconds || undefined,
        message: `Render complete. Sent Telegram approval query for job ${jobId}.`,
      });

      console.log(`[Scheduler] Production pipeline successfully finished. Job ${jobId} awaiting Telegram approval.`);
    } catch (err) {
      console.error(`[Scheduler] Error running automated pipeline for job ${jobId}:`, err);
      await this.history.record({
        eventType: "failed",
        jobId,
        message: `Automated pipeline failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      // Finished pipeline execution
    }
  }

  private async tick(): Promise<void> {
    try {
      await this.triggerIfDue();
    } catch (err) {
      console.error("[Scheduler] Error in scheduler tick:", err);
    }
  }
}

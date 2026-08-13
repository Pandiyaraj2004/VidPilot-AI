import { SchedulerConfigRepository } from "./schedulerConfigRepository.js";
import { AutomationHistory } from "./automationHistory.js";
import { SchedulerLock } from "./schedulerLock.js";
import { selectNextVariation } from "./variationEngine.js";
import { createJob, processQueuedJob, generateVoiceForJob, renderVideoForJob, runQualityCheckForJob, uploadVideoForJob } from "../jobs/jobService.js";
import { sendApprovalRequestForJob } from "../telegram/sendApproval.js";
import { VOICE_OPTIONS } from "../voice/voiceConfig.js";
import type { SchedulerConfig } from "../../types/index.js";

let checkInterval: NodeJS.Timeout | null = null;
export function validateSchedulerConfig(patch: Partial<SchedulerConfig>): void {
  if (patch.intervalHours !== undefined) {
    if (typeof patch.intervalHours !== "number" || patch.intervalHours < 1) {
      throw new Error("Interval hours must be a positive number.");
    }
  }

  if (patch.timezone !== undefined) {
    if (typeof patch.timezone !== "string") {
      throw new Error("Timezone must be a string.");
    }
    try {
      Intl.DateTimeFormat(undefined, { timeZone: patch.timezone });
    } catch {
      throw new Error(`Invalid timezone: ${patch.timezone}`);
    }
  }

  if (patch.minDurationSeconds !== undefined) {
    if (typeof patch.minDurationSeconds !== "number" || patch.minDurationSeconds < 10) {
      throw new Error("minDurationSeconds must be a number >= 10.");
    }
  }

  if (patch.maxDurationSeconds !== undefined) {
    if (typeof patch.maxDurationSeconds !== "number" || patch.maxDurationSeconds > 300) {
      throw new Error("maxDurationSeconds must be a number <= 300.");
    }
  }

  if (patch.minDurationSeconds !== undefined && patch.maxDurationSeconds !== undefined) {
    if (patch.minDurationSeconds > patch.maxDurationSeconds) {
      throw new Error("minDurationSeconds cannot be greater than maxDurationSeconds.");
    }
  }

  if (patch.languages !== undefined) {
    if (!Array.isArray(patch.languages) || patch.languages.length === 0) {
      throw new Error("languages must be a non-empty array of strings.");
    }
    const supported = ["en", "ta", "hi"];
    for (const lang of patch.languages) {
      if (!supported.includes(lang)) {
        throw new Error(`Unsupported language: ${lang}`);
      }
    }
  }

  if (patch.enabledVoices !== undefined) {
    if (!Array.isArray(patch.enabledVoices) || patch.enabledVoices.length === 0) {
      throw new Error("enabledVoices must be a non-empty array of strings.");
    }
    const validVoiceIds = VOICE_OPTIONS.map((v) => v.id);
    for (const voiceId of patch.enabledVoices) {
      if (!validVoiceIds.includes(voiceId)) {
        throw new Error(`Invalid voice ID: ${voiceId}`);
      }
    }
  }

  if (patch.contentCategories !== undefined) {
    if (!Array.isArray(patch.contentCategories) || patch.contentCategories.length === 0) {
      throw new Error("contentCategories must be a non-empty array.");
    }
    const validCategories = [
      "science", "general_knowledge", "technology", "history", "mystery",
      "motivation", "facts", "space", "ai", "business", "psychology", "story", "news"
    ];
    for (const cat of patch.contentCategories) {
      if (!validCategories.includes(cat)) {
        throw new Error(`Invalid content category: ${cat}`);
      }
    }
  }

  if (patch.requireApproval !== undefined) {
    if (typeof patch.requireApproval !== "boolean") {
      throw new Error("requireApproval must be a boolean.");
    }
  }

  if (patch.youtubeVisibility !== undefined) {
    const validVisibility = ["private", "unlisted", "public"];
    if (!validVisibility.includes(patch.youtubeVisibility)) {
      throw new Error(`Invalid YouTube visibility: ${patch.youtubeVisibility}`);
    }
  }
}

export class SchedulerService {
  public readonly configRepo = new SchedulerConfigRepository();
  public readonly history = new AutomationHistory();
  public readonly lock = new SchedulerLock();

  async getConfig(): Promise<SchedulerConfig> {
    const config = await this.configRepo.get();
    if (config.automationEnabled && !config.nextGenerationAt) {
      const now = new Date();
      config.nextGenerationAt = new Date(now.getTime() + config.intervalHours * 60 * 60 * 1000).toISOString();
      await this.configRepo.set(config);
      await this.history.record({
        eventType: "scheduler_recalculated",
        message: `Schedule recalculated (missing nextGenerationAt): next run scheduled at ${config.nextGenerationAt}`,
      });
    }
    return config;
  }

  async updateConfig(newConfig: Partial<SchedulerConfig>): Promise<SchedulerConfig> {
    validateSchedulerConfig(newConfig);
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
      
      // Compute next slot in the future to handle server downtime safely (prevent rapid succession catchups)
      let nextSlotTime = nextRun.getTime();
      while (nextSlotTime <= now.getTime()) {
        nextSlotTime += config.intervalHours * 60 * 60 * 1000;
      }
      const nextSlot = new Date(nextSlotTime).toISOString();
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

      if (qcJob.status === "ready") {
        if (config.requireApproval) {
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
        } else {
          // Auto-approve and upload directly
          console.log(`[Scheduler] Auto-approving job ${jobId} (requireApproval is false)...`);
          const decidedAt = new Date().toISOString();
          const { jobRepository } = await import("../jobs/index.js");
          await jobRepository.updateJob(jobId, {
            status: "approved",
            approvedAt: decidedAt,
            approval: {
              status: "approved",
              version: 1,
              renderVersion: qcJob.renderVersion,
              sentAt: decidedAt,
              decision: "approved",
              reason: "Auto-approved by scheduler (requireApproval = false)",
              decidedAt,
              pendingReasonPromptMessageId: null,
            },
          });

          await this.history.record({
            eventType: "auto_approved",
            jobId,
            topic: selection.topic,
            category: selection.category,
            language: selection.language,
            voice: selection.voiceId,
            storyStructure: selection.storyStructure,
            hookType: selection.hookType,
            targetDuration: selection.durationSeconds,
            actualDuration: qcJob.videoRender?.durationSeconds || undefined,
            message: `Render complete. Auto-approved job ${jobId}.`,
          });

          console.log(`[Scheduler] Triggering YouTube upload for auto-approved job ${jobId}...`);
          try {
            await uploadVideoForJob(jobId);
            await this.history.record({
              eventType: "published",
              jobId,
              message: `Successfully uploaded and published job ${jobId} to YouTube.`,
            });
            console.log(`[Scheduler] Auto-upload complete for job ${jobId}.`);
          } catch (uploadErr) {
            console.error(`[Scheduler] YouTube auto-upload failed for job ${jobId}:`, uploadErr);
          }
        }
      } else {
        console.warn(`[Scheduler] Job ${jobId} failed Quality Control check. Status is ${qcJob.status}`);
      }
    } catch (err) {
      console.error(`[Scheduler] Error running automated pipeline for job ${jobId}:`, err);
      await this.history.record({
        eventType: "failed",
        jobId,
        message: `Automated pipeline failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  async processVideoReadyJobs(): Promise<void> {
    try {
      const { jobRepository } = await import("../jobs/index.js");
      const videoReadyJobs = await jobRepository.listJobs({ status: "video_ready" });
      
      if (videoReadyJobs.length === 0) return;

      console.log(`[Scheduler] Found ${videoReadyJobs.length} job(s) at video_ready status. Running quality checks...`);

      for (const job of videoReadyJobs) {
        // Run quality check asynchronously in background
        void (async () => {
          try {
            console.log(`[Scheduler] Running quality check for video_ready job ${job.id}...`);
            const qcJob = await runQualityCheckForJob(job.id);
            
            if (qcJob.status === "ready") {
              console.log(`[Scheduler] Quality check passed for job ${job.id}. Now sending Telegram approval...`);
              
              const config = await this.configRepo.get();
              if (qcJob.approvalRequired && config.requireApproval) {
                try {
                  await sendApprovalRequestForJob(job.id);
                  await this.history.record({
                    eventType: "awaiting_approval",
                    jobId: job.id,
                    message: `Quality check passed. Sent Telegram approval request for job ${job.id}.`,
                  });
                  console.log(`[Scheduler] Telegram approval sent for job ${job.id}.`);
                } catch (approvalErr) {
                  console.error(`[Scheduler] Failed to send Telegram approval for job ${job.id}:`, approvalErr);
                }
              }
            } else {
              console.warn(`[Scheduler] Quality check failed for job ${job.id}. Status is ${qcJob.status}`);
            }
          } catch (err) {
            console.error(`[Scheduler] Quality check failed for video_ready job ${job.id}:`, err);
          }
        })();
      }
    } catch (err) {
      console.error("[Scheduler] Error in processVideoReadyJobs:", err);
    }
  }

  async processReadyJobs(): Promise<void> {
    try {
      const { jobRepository } = await import("../jobs/index.js");
      const readyJobs = await jobRepository.listJobs({ status: "ready" });
      
      if (readyJobs.length === 0) return;

      // Filter for jobs that haven't had approval sent yet (telegramMessageId is null)
      const needsApprovalSent = readyJobs.filter(job => job.approvalRequired && !job.telegramMessageId);
      
      if (needsApprovalSent.length === 0) return;

      console.log(`[Scheduler] Found ${needsApprovalSent.length} ready job(s) that need Telegram approval sent.`);

      for (const job of needsApprovalSent) {
        // Send approval asynchronously in background
        void (async () => {
          try {
            console.log(`[Scheduler] Sending Telegram approval for ready job ${job.id}...`);
            await sendApprovalRequestForJob(job.id);
            await this.history.record({
              eventType: "awaiting_approval",
              jobId: job.id,
              message: `Sent Telegram approval request for ready job ${job.id}.`,
            });
            console.log(`[Scheduler] Telegram approval sent for job ${job.id}.`);
          } catch (err) {
            console.error(`[Scheduler] Failed to send Telegram approval for ready job ${job.id}:`, err);
          }
        })();
      }
    } catch (err) {
      console.error("[Scheduler] Error in processReadyJobs:", err);
    }
  }

  async processApprovedUploads(): Promise<void> {
    try {
      const { jobRepository } = await import("../jobs/index.js");
      const approvedJobs = await jobRepository.listJobs({ status: "approved" });
      
      if (approvedJobs.length === 0) return;

      console.log(`[Scheduler] Found ${approvedJobs.length} approved job(s) eligible for YouTube upload.`);

      for (const job of approvedJobs) {
        // Run upload asynchronously in background
        void (async () => {
          try {
            console.log(`[Scheduler] Automatically uploading approved job ${job.id} to YouTube...`);
            await uploadVideoForJob(job.id);
            await this.history.record({
              eventType: "published",
              jobId: job.id,
              message: `Successfully uploaded and published job ${job.id} to YouTube.`,
            });
            console.log(`[Scheduler] Successfully uploaded approved job ${job.id} to YouTube.`);
          } catch (err) {
            console.error(`[Scheduler] Auto-upload failed for job ${job.id}:`, err);
          }
        })();
      }
    } catch (err) {
      console.error("[Scheduler] Error in processApprovedUploads:", err);
    }
  }

  private async tick(): Promise<void> {
    try {
      await this.triggerIfDue();
    } catch (err) {
      console.error("[Scheduler] Error in scheduler tick (triggerIfDue):", err);
    }
    try {
      await this.processVideoReadyJobs();
    } catch (err) {
      console.error("[Scheduler] Error in scheduler tick (processVideoReadyJobs):", err);
    }
    try {
      await this.processReadyJobs();
    } catch (err) {
      console.error("[Scheduler] Error in scheduler tick (processReadyJobs):", err);
    }
    try {
      await this.processApprovedUploads();
    } catch (err) {
      console.error("[Scheduler] Error in scheduler tick (processApprovedUploads):", err);
    }
  }
}

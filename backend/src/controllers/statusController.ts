import type { Request, Response } from "express";
import { config, isConfigured } from "../config/env.js";
import { isFirebaseConfigured } from "../services/firebase/index.js";
import { isSupabaseConfigured } from "../services/supabase/index.js";
import { youtubeProvider } from "../services/youtube/index.js";
import { getSchedulerService } from "../services/scheduler/index.js";
import type { SystemStatus } from "../types/index.js";

export async function getSystemStatus(_req: Request, res: Response, next: (err?: unknown) => void): Promise<void> {
  try {
    const youtubeConnected = await youtubeProvider.isConnected();
    const scheduler = getSchedulerService();
    const schedulerConfig = await scheduler.getConfig();

    const { jobRepository } = await import("../services/jobs/index.js");
    const [
      awaitingApprovalJobs,
      approvedJobs,
      publishedJobs,
      failedJobs,
      generatingScriptJobs,
      generatingVoiceJobs,
      renderingJobs
    ] = await Promise.all([
      jobRepository.listJobs({ status: "awaiting_approval" }),
      jobRepository.listJobs({ status: "approved" }),
      jobRepository.listJobs({ status: "published" }),
      jobRepository.listJobs({ status: "failed" }),
      jobRepository.listJobs({ status: "generating_script" }),
      jobRepository.listJobs({ status: "generating_voice" }),
      jobRepository.listJobs({ status: "rendering" }),
    ]);

    const waitingForApprovalCount = awaitingApprovalJobs.length;
    const approvedWaitingToUploadCount = approvedJobs.length;
    const publishedCount = publishedJobs.length;
    const failedJobsCount = failedJobs.length;
    const currentlyProcessing = [
      ...generatingScriptJobs,
      ...generatingVoiceJobs,
      ...renderingJobs
    ].map(j => j.id);

    const status: SystemStatus = {
      vidpilot: "operational",
      database: (isSupabaseConfigured() || isFirebaseConfigured()) ? "connected" : "disconnected",
      automation: schedulerConfig.automationEnabled ? "running" : "ready",
      telegram: isConfigured(config.telegram.botToken) && isConfigured(config.telegram.chatId) ? "connected" : "not_connected",
      youtube: youtubeConnected ? "connected" : "not_connected",
      schedulerState: {
        automationEnabled: schedulerConfig.automationEnabled,
        schedulerRunning: schedulerConfig.automationEnabled,
        intervalHours: schedulerConfig.intervalHours,
        timezone: schedulerConfig.timezone || "UTC",
        requireApproval: schedulerConfig.requireApproval,
        nextGenerationAt: schedulerConfig.nextGenerationAt,
        lastGenerationAt: schedulerConfig.lastGenerationAt,
        currentlyProcessing,
        waitingForApprovalCount,
        approvedWaitingToUploadCount,
        publishedCount,
        failedJobsCount
      }
    };

    res.json(status);
  } catch (err) {
    next(err);
  }
}

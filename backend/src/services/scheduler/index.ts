import type { SchedulerConfig } from "../../types/index.js";

/**
 * Placeholder for the elapsed-time automation scheduler (Phase 9).
 * Real implementation compares `now >= nextGenerationAt` rather than using
 * a fixed cron expression, and tracks generation/publication success
 * independently from the timer.
 */
export class SchedulerService {
  async getConfig(): Promise<SchedulerConfig> {
    throw new Error("SchedulerService.getConfig() is not implemented yet. Ships in Phase 9.");
  }

  async triggerIfDue(): Promise<boolean> {
    throw new Error("SchedulerService.triggerIfDue() is not implemented yet. Ships in Phase 9.");
  }
}

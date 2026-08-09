import type { AnalyticsSummary, AnalyticsTimePoint } from "@/types";

/** YouTube Analytics API placeholder — ships in Phase 11. */
export const analyticsService = {
  async getSummary(): Promise<AnalyticsSummary | null> {
    return null;
  },

  async getViewsOverTime(): Promise<AnalyticsTimePoint[]> {
    return [];
  },
};

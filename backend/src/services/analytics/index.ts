export interface AnalyticsSummary {
  views: number;
  likes: number;
  comments: number;
  watchTimeMinutes: number;
  subscribersGained: number;
  subscribersLost: number;
}

/**
 * Placeholder for the YouTube Analytics API integration (Phase 11).
 */
export class AnalyticsService {
  async getChannelSummary(): Promise<AnalyticsSummary> {
    throw new Error(
      "AnalyticsService.getChannelSummary() is not implemented yet. Ships in Phase 11."
    );
  }
}

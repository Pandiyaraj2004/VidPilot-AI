export interface AnalyticsSummary {
  views: number;
  likes: number;
  comments: number;
  watchTimeHours: number;
  subscribersGained: number;
  subscribersLost: number;
}

export interface AnalyticsTimePoint {
  date: string;
  views: number;
}

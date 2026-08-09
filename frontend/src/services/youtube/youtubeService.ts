import type { YouTubeVisibility } from "@/types";

export interface YouTubeUploadRequest {
  jobId: string;
  visibility: YouTubeVisibility;
  containsSyntheticMedia: boolean;
}

export interface YouTubeConnectionInfo {
  connected: boolean;
}

/** YouTube Data API OAuth + upload placeholder — ships in Phase 8. */
export const youtubeService = {
  async getConnectionInfo(): Promise<YouTubeConnectionInfo> {
    return { connected: false };
  },

  async upload(_request: YouTubeUploadRequest): Promise<{ youtubeVideoId: string }> {
    throw new Error("YouTube upload is not connected yet. It ships in Phase 8.");
  },
};

export interface YouTubeUploadRequest {
  jobId: string;
  videoFilePath: string;
  title: string;
  description: string;
  tags: string[];
  visibility: "private" | "unlisted" | "public";
  containsSyntheticMedia: boolean;
}

export interface YouTubeUploadResult {
  youtubeVideoId: string;
}

/**
 * Placeholder for OAuth + videos.insert upload flow (Phase 8).
 */
export class YouTubeService {
  async upload(_request: YouTubeUploadRequest): Promise<YouTubeUploadResult> {
    throw new Error("YouTubeService.upload() is not implemented yet. Ships in Phase 8.");
  }
}

/**
 * Backend-only YouTube provider abstraction (Phase 11) — mirrors the
 * project's existing TelegramProvider/VisualProvider pattern: the upload
 * workflow (youtubeUploadService.ts, jobService.ts) depends only on this
 * interface, never on the Google APIs client directly.
 * YouTubeDataApiProvider (youtubeDataApiProvider.ts) is the one real
 * implementation; FakeYouTubeProvider (test-only) lets the rest of the
 * suite stay deterministic without a real Google account.
 */

import type { YouTubeVisibility } from "../../types/index.js";

export interface YouTubeChannelInfo {
  id: string;
  title: string;
  thumbnailUrl: string | null;
}

export interface YouTubeUploadMetadata {
  title: string;
  description: string;
  tags: string[];
  /** A real YouTube video category id — see youtubeCategoryMap.ts. */
  categoryId: string;
  privacyStatus: YouTubeVisibility;
  /** BCP-47 language tag (e.g. "en", "hi", "ta") — the video's actual spoken language, never silently changed. */
  defaultLanguage: string;
  madeForKids: boolean;
  /** Real YouTube Data API field (status.containsSyntheticMedia, added 2024) for AI/altered-content disclosure — not an invented field. */
  containsSyntheticMedia: boolean;
}

export class YouTubeApiError extends Error {
  constructor(
    message: string,
    /** Lets callers distinguish "token is dead, user must reconnect" from a transient/quota failure without parsing message text. */
    public readonly reason: "not_connected" | "invalid_grant" | "quota_exceeded" | "network" | "api_error" = "api_error"
  ) {
    super(message);
    this.name = "YouTubeApiError";
  }
}

export interface YouTubeProvider {
  /** True when GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET are set — independent of whether a user has actually connected an account yet. */
  isConfigured(): boolean;
  /** True when a real, usable (or refreshable) token is on file. */
  isConnected(): Promise<boolean>;
  /** Builds the real Google consent-screen URL for the minimum required scopes (youtube.upload + youtube.readonly). */
  getAuthUrl(state: string): string;
  /** Exchanges a real authorization code for tokens, persists them, and returns the real connected channel. */
  handleCallback(code: string): Promise<YouTubeChannelInfo>;
  /** Null when not connected — never throws just because there's no token yet. */
  getChannelInfo(): Promise<YouTubeChannelInfo | null>;
  /** Revokes the token with Google where possible and always clears local storage, even if the revoke call itself fails (e.g. already revoked). */
  disconnect(): Promise<void>;
  /** Real resumable upload via videos.insert. Never called unless the caller has already run the full approval gate. */
  uploadVideo(input: { filePath: string; metadata: YouTubeUploadMetadata }): Promise<{ videoId: string }>;
  /** Real thumbnails.set call — kept separate from uploadVideo so a thumbnail failure never implies the video upload also failed. */
  uploadThumbnail(videoId: string, thumbnailPath: string): Promise<void>;
}

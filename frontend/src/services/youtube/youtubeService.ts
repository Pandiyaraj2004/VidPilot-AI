import { apiGet, apiPost, apiUrl } from "@/services/api/client";

export interface YouTubeChannelInfo {
  id: string;
  title: string;
  thumbnailUrl: string | null;
}

export interface YouTubeStatus {
  connected: boolean;
  channel: YouTubeChannelInfo | null;
  configured: boolean;
}

export interface YouTubeDisconnectResult {
  connected: false;
  channel: null;
}

/**
 * Real backend-mediated Google OAuth + YouTube Data API (Phase 11) — no
 * client secret or token ever reaches this module or the browser. Connecting
 * is a real page navigation to Google's own consent screen, not a fetch()
 * call: the backend redirects here, the user signs in and approves on
 * Google's real page, and Google redirects back to the backend's callback,
 * which finally redirects the browser back into this app.
 */
export const youtubeService = {
  getStatus(): Promise<YouTubeStatus> {
    return apiGet<YouTubeStatus>("/youtube/status");
  },

  /** The URL to navigate the whole browser to (never fetch) in order to start the real OAuth consent flow. */
  authUrl(): string {
    return apiUrl("/youtube/auth");
  },

  disconnect(): Promise<YouTubeDisconnectResult> {
    return apiPost<YouTubeDisconnectResult>("/youtube/disconnect");
  },
};

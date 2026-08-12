/**
 * Real YouTube Data API v3 + Google OAuth2 client (Phase 11) — uses the
 * official `googleapis` package rather than a hand-rolled HTTP client
 * (unlike Jamendo/Pixabay/Pexels/Telegram elsewhere in this project):
 * OAuth2 token refresh and the resumable upload protocol are exactly the
 * kind of thing worth getting from Google's own maintained client instead
 * of reimplementing.
 *
 * The token/client secret never leave this process — nothing here is ever
 * serialized into an API response sent to the frontend.
 */

import { createReadStream } from "node:fs";
import { google } from "googleapis";
import { config, isConfigured } from "../../config/env.js";
import { clearToken, readToken, writeToken, type StoredYouTubeToken } from "./tokenStore.js";
import { YouTubeApiError, type YouTubeChannelInfo, type YouTubeProvider, type YouTubeUploadMetadata } from "./youtubeProvider.js";

// Minimum scopes for the actual functionality used: uploading a video +
// its thumbnail, and reading back the connected channel's own identity to
// show real "Connected as <channel>" status. Nothing broader (no
// youtube.force-ssl, no full "youtube" scope) since nothing here manages
// playlists, comments, or subscriptions.
const SCOPES = ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube.readonly"];

function isGaxiosLikeError(err: unknown): err is { code?: string | number; response?: { status?: number; data?: { error?: { errors?: { reason?: string }[] } } }; message?: string } {
  return typeof err === "object" && err !== null;
}

/** Runs a real Google API call and rethrows any failure as a classified YouTubeApiError, rather than letting an overload-heavy googleapis method's raw error escape uninterpreted. */
async function callOrThrow<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof YouTubeApiError) throw err;
    throw classifyError(err);
  }
}

function classifyError(err: unknown): YouTubeApiError {
  const message = err instanceof Error ? err.message : String(err);
  if (!isGaxiosLikeError(err)) return new YouTubeApiError(message, "api_error");

  if (message.includes("invalid_grant") || err.code === "invalid_grant") {
    return new YouTubeApiError("Your YouTube connection has expired or was revoked — please reconnect.", "invalid_grant");
  }
  const reasons = err.response?.data?.error?.errors?.map((e) => e.reason) ?? [];
  if (reasons.includes("quotaExceeded") || reasons.includes("dailyLimitExceeded")) {
    return new YouTubeApiError("YouTube API quota exceeded for today — try again later.", "quota_exceeded");
  }
  if (err.code === "ENOTFOUND" || err.code === "ECONNREFUSED" || err.code === "ETIMEDOUT") {
    return new YouTubeApiError("Could not reach the YouTube API — check network connectivity.", "network");
  }
  return new YouTubeApiError(message, "api_error");
}

export class YouTubeDataApiProvider implements YouTubeProvider {
  isConfigured(): boolean {
    return isConfigured(config.youtube.googleClientId) && isConfigured(config.youtube.googleClientSecret);
  }

  private createOAuthClient() {
    return new google.auth.OAuth2(config.youtube.googleClientId, config.youtube.googleClientSecret, config.youtube.redirectUri);
  }

  /**
   * Loads the stored token onto a fresh OAuth2 client and wires it to
   * persist any token Google hands back after an automatic refresh —
   * without this, a refreshed access token would only live in memory for
   * the current process and every restart would force an extra refresh
   * round trip.
   */
  private async getAuthorizedClient(): Promise<{ client: InstanceType<typeof google.auth.OAuth2>; stored: StoredYouTubeToken } | null> {
    const stored = await readToken();
    if (!stored?.refreshToken) return null;

    const client = this.createOAuthClient();
    client.setCredentials({
      access_token: stored.accessToken ?? undefined,
      refresh_token: stored.refreshToken,
      expiry_date: stored.expiryDate ?? undefined,
    });
    client.on("tokens", (tokens) => {
      void writeToken({
        accessToken: tokens.access_token ?? stored.accessToken,
        refreshToken: tokens.refresh_token ?? stored.refreshToken,
        expiryDate: tokens.expiry_date ?? stored.expiryDate,
        channel: stored.channel,
        connectedAt: stored.connectedAt,
      });
    });
    return { client, stored };
  }

  async isConnected(): Promise<boolean> {
    const stored = await readToken();
    return Boolean(stored?.refreshToken);
  }

  getAuthUrl(state: string): string {
    const client = this.createOAuthClient();
    return client.generateAuthUrl({
      access_type: "offline",
      // Forces Google to return a refresh_token even on a re-consent from
      // an account that's authorized this app before — without it, a
      // second connect attempt can silently come back with no
      // refresh_token at all (Google only issues one on the *first*
      // consent by default).
      prompt: "consent",
      scope: SCOPES,
      state,
    });
  }

  async handleCallback(code: string): Promise<YouTubeChannelInfo> {
    const client = this.createOAuthClient();
    const { tokens } = await callOrThrow(() => client.getToken(code));
    if (!tokens.refresh_token) {
      throw new YouTubeApiError(
        "Google did not return a refresh token — disconnect any prior authorization for this app in your Google Account and try connecting again.",
        "invalid_grant"
      );
    }
    client.setCredentials(tokens);

    const channel = await this.fetchChannelInfo(client);
    await writeToken({
      accessToken: tokens.access_token ?? null,
      refreshToken: tokens.refresh_token,
      expiryDate: tokens.expiry_date ?? null,
      channel,
      connectedAt: new Date().toISOString(),
    });
    return channel;
  }

  private async fetchChannelInfo(client: InstanceType<typeof google.auth.OAuth2>): Promise<YouTubeChannelInfo> {
    const youtube = google.youtube({ version: "v3", auth: client });
    const response = await callOrThrow(() => youtube.channels.list({ part: ["snippet"], mine: true }));
    const item = response.data.items?.[0];
    if (!item?.id) {
      throw new YouTubeApiError("Google authorized this app but no YouTube channel was found on that account.", "api_error");
    }
    return {
      id: item.id,
      title: item.snippet?.title ?? "Unknown channel",
      thumbnailUrl: item.snippet?.thumbnails?.default?.url ?? null,
    };
  }

  async getChannelInfo(): Promise<YouTubeChannelInfo | null> {
    const stored = await readToken();
    if (!stored?.refreshToken) return null;
    // The channel identity captured at connect time — re-fetching on every
    // status check would burn API quota for information that essentially
    // never changes for a single-user app; a real refetch only happens on
    // reconnect (handleCallback).
    return stored.channel;
  }

  async disconnect(): Promise<void> {
    const stored = await readToken();
    if (stored?.accessToken || stored?.refreshToken) {
      const client = this.createOAuthClient();
      try {
        await client.revokeToken(stored.accessToken ?? stored.refreshToken!);
      } catch {
        // Best-effort — an already-revoked or expired token still fails
        // here, but the local disconnect below must always proceed so the
        // UI never gets stuck reporting "connected" for a dead credential.
      }
    }
    await clearToken();
  }

  async uploadVideo(input: { filePath: string; metadata: YouTubeUploadMetadata }): Promise<{ videoId: string }> {
    const authorized = await this.getAuthorizedClient();
    if (!authorized) throw new YouTubeApiError("YouTube is not connected.", "not_connected");

    const youtube = google.youtube({ version: "v3", auth: authorized.client });
    try {
      // googleapis' own transport (gaxios) performs a real resumable
      // upload when given a stream body — the official mechanism for
      // large files, not a hand-rolled chunked-upload implementation.
      const response = await youtube.videos.insert({
        part: ["snippet", "status"],
        requestBody: {
          snippet: {
            title: input.metadata.title,
            description: input.metadata.description,
            tags: input.metadata.tags,
            categoryId: input.metadata.categoryId,
            defaultLanguage: input.metadata.defaultLanguage,
            defaultAudioLanguage: input.metadata.defaultLanguage,
          },
          status: {
            privacyStatus: input.metadata.privacyStatus,
            selfDeclaredMadeForKids: input.metadata.madeForKids,
            containsSyntheticMedia: input.metadata.containsSyntheticMedia,
          },
        },
        media: {
          body: createReadStream(input.filePath),
        },
      });
      const videoId = response.data.id;
      if (!videoId) throw new YouTubeApiError("YouTube accepted the upload but returned no video id.", "api_error");
      return { videoId };
    } catch (err) {
      if (err instanceof YouTubeApiError) throw err;
      throw classifyError(err);
    }
  }

  async uploadThumbnail(videoId: string, thumbnailPath: string): Promise<void> {
    const authorized = await this.getAuthorizedClient();
    if (!authorized) throw new YouTubeApiError("YouTube is not connected.", "not_connected");

    const youtube = google.youtube({ version: "v3", auth: authorized.client });
    try {
      await youtube.thumbnails.set({
        videoId,
        media: { body: createReadStream(thumbnailPath) },
      });
    } catch (err) {
      throw classifyError(err);
    }
  }
}

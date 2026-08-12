/**
 * Persists the real Google OAuth token for this single-user app to a local
 * JSON file (never Firestore — this is a live credential, not job
 * metadata, same reasoning as why Piper/ffmpeg binaries live in
 * backend/vendor/ rather than the database). Read only by
 * youtubeDataApiProvider.ts — nothing else touches this file, and nothing
 * in this module ever logs a token value.
 */

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "../../config/env.js";
import type { YouTubeChannelInfo } from "./youtubeProvider.js";

export interface StoredYouTubeToken {
  accessToken: string | null;
  refreshToken: string | null;
  /** Epoch milliseconds — when accessToken stops being usable without a refresh. */
  expiryDate: number | null;
  channel: YouTubeChannelInfo | null;
  connectedAt: string | null;
}

export async function readToken(): Promise<StoredYouTubeToken | null> {
  try {
    const raw = await readFile(config.youtube.tokenStorePath, "utf-8");
    return JSON.parse(raw) as StoredYouTubeToken;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function writeToken(token: StoredYouTubeToken): Promise<void> {
  await mkdir(path.dirname(config.youtube.tokenStorePath), { recursive: true });
  await writeFile(config.youtube.tokenStorePath, JSON.stringify(token, null, 2), "utf-8");
}

export async function clearToken(): Promise<void> {
  await rm(config.youtube.tokenStorePath, { force: true });
}

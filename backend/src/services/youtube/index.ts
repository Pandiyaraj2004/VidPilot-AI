/**
 * Single shared YouTubeDataApiProvider instance — everything that talks to
 * YouTube (youtubeUploadService.ts, controllers/routes) imports the same
 * instance from here, matching the singleton pattern already used for
 * jobRepository (services/jobs/index.ts) and telegramProvider
 * (services/telegram/index.ts).
 */

import { YouTubeDataApiProvider } from "./youtubeDataApiProvider.js";
import type { YouTubeProvider } from "./youtubeProvider.js";

export const youtubeProvider: YouTubeProvider = new YouTubeDataApiProvider();

export type { YouTubeChannelInfo, YouTubeUploadMetadata, YouTubeProvider } from "./youtubeProvider.js";
export { YouTubeApiError } from "./youtubeProvider.js";

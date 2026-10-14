/**
 * Single shared YouTubeDataApiProvider instance — everything that talks to
 * YouTube (youtubeUploadService.ts, controllers/routes) imports the same
 * instance from here, matching the singleton pattern already used for
 */
import { YouTubeDataApiProvider } from "./youtubeDataApiProvider.js";
export const youtubeProvider = new YouTubeDataApiProvider();
export { YouTubeApiError } from "./youtubeProvider.js";

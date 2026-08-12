import "dotenv/config";
import path from "node:path";

interface AppConfig {
  port: number;
  nodeEnv: string;
  firebase: {
    projectId: string | undefined;
    serviceAccountJson: string | undefined;
  };
  ai: {
    geminiApiKey: string | undefined;
    geminiModel: string;
    openRouterApiKey: string | undefined;
    openRouterModel: string;
    requestTimeoutMs: number;
  };
  piper: {
    executablePath: string;
    espeakDataPath: string;
    voicesDir: string;
    /** Where generated scene audio is written — a workspace, not permanent storage. See services/voice/audioStorage.ts. */
    storageDir: string;
    /** Piper itself has no timeout; this guards against a hung subprocess. */
    processTimeoutMs: number;
  };
  ffmpeg: {
    ffmpegPath: string;
    ffprobePath: string;
    processTimeoutMs: number;
  };
  rendering: {
    fontsDir: string;
    storageDir: string;
    width: number;
    height: number;
    fps: number;
    /** Remotion drives an existing Chrome install rather than downloading its own Chromium. */
    chromiumExecutablePath: string | undefined;
    renderTimeoutMs: number;
  };
  edgeTts: {
    timeoutMs: number;
  };
  visuals: {
    pixabayApiKey: string | undefined;
    pexelsApiKey: string | undefined;
    /** Upper bound on downloaded video height — keeps downloads/renders fast; a personal-app performance budget, not a quality ceiling. */
    maxVideoHeight: number;
    maxImageWidth: number;
    /** Shared across all jobs — the same source is never re-downloaded once cached here. */
    assetCacheDir: string;
    requestTimeoutMs: number;
    /** Soft cap on unique internet-asset downloads per job; hitting it is logged, never silently truncated. */
    maxAssetsPerJob: number;
  };
  music: {
    /** User-populated folder of real, rights-cleared tracks + manifest.json — see services/audio/musicProvider.ts. Empty/missing is valid (no music), never a crash. */
    musicAssetsDir: string;
    sfxAssetsDir: string;
    /** Music volume before sidechain ducking is applied — a static floor under the dynamic dip. */
    musicVolume: number;
    sfxVolume: number;
    /** Jamendo (real music API, primary source) — client_id only; client_secret is stored but unused by this read-only integration. See services/audio/jamendoProvider.ts. */
    jamendoClientId: string | undefined;
    jamendoClientSecret: string | undefined;
    jamendoCacheDir: string;
    /** Search requests only — small JSON responses, fast regardless of the track's own size. */
    jamendoTimeoutMs: number;
    /** Separate, longer timeout for the actual audio download — Jamendo's storage CDN measured well under 200 KB/s from this environment, so a multi-MB track routinely needs 20-30s+; reusing the search timeout here was cutting off otherwise-successful downloads. */
    jamendoDownloadTimeoutMs: number;
  };
  telegram: {
    botToken: string | undefined;
    chatId: string | undefined;
    /** Validated against Telegram's own X-Telegram-Bot-Api-Secret-Token header on incoming webhook requests. Optional — the long-poll transport (services/telegram/telegramPoller.ts) doesn't need it. */
    webhookSecret: string | undefined;
  };
  youtube: {
    googleClientId: string | undefined;
    googleClientSecret: string | undefined;
    /** Must exactly match a redirect URI registered on this OAuth client in Google Cloud Console. */
    redirectUri: string;
    /** Where the real OAuth token (access + refresh + expiry + channel info) is persisted — see services/youtube/tokenStore.ts. Never Firestore: this is a live credential, not job metadata. */
    tokenStorePath: string;
    /** Where the browser is sent back to once the Google consent redirect completes (GET /api/youtube/auth is a real 302 to Google, not a fetch call) — the only place this app needs to know the frontend's own origin. */
    frontendUrl: string;
  };
}

/**
 * Single read point for process.env. Nothing here is ever sent to the
 * frontend — routes/controllers should expose derived booleans
 * (e.g. "configured: true/false"), never the raw values.
 */
export const config: AppConfig = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    serviceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT,
  },
  ai: {
    geminiApiKey: process.env.GEMINI_API_KEY,
    geminiModel: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
    openRouterApiKey: process.env.OPENROUTER_API_KEY,
    openRouterModel: process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini",
    requestTimeoutMs: Number(process.env.AI_REQUEST_TIMEOUT_MS ?? 45000),
  },
  piper: {
    executablePath: process.env.PIPER_EXECUTABLE_PATH ?? path.join(process.cwd(), "vendor", "piper", "piper.exe"),
    espeakDataPath: process.env.PIPER_ESPEAK_DATA_PATH ?? path.join(process.cwd(), "vendor", "piper", "espeak-ng-data"),
    voicesDir: process.env.PIPER_VOICES_DIR ?? path.join(process.cwd(), "vendor", "piper-voices"),
    storageDir: process.env.VOICE_STORAGE_DIR ?? path.join(process.cwd(), "storage", "jobs"),
    processTimeoutMs: Number(process.env.PIPER_TIMEOUT_MS ?? 30000),
  },
  ffmpeg: {
    ffmpegPath:
      process.env.FFMPEG_PATH ??
      path.join(process.cwd(), "vendor", "ffmpeg", "ffmpeg-n7.1-latest-win64-gpl-7.1", "bin", "ffmpeg.exe"),
    ffprobePath:
      process.env.FFPROBE_PATH ??
      path.join(process.cwd(), "vendor", "ffmpeg", "ffmpeg-n7.1-latest-win64-gpl-7.1", "bin", "ffprobe.exe"),
    processTimeoutMs: Number(process.env.FFMPEG_TIMEOUT_MS ?? 120000),
  },
  rendering: {
    fontsDir: process.env.FONTS_DIR ?? path.join(process.cwd(), "assets", "fonts"),
    storageDir: process.env.VIDEO_STORAGE_DIR ?? path.join(process.cwd(), "storage", "jobs"),
    // Vertical Shorts by default — set VIDEO_WIDTH=1920/VIDEO_HEIGHT=1080 to
    // switch a deployment back to landscape; nothing else needs to change,
    // see remotion/Root.tsx's calculateMetadata.
    width: Number(process.env.VIDEO_WIDTH ?? 1080),
    height: Number(process.env.VIDEO_HEIGHT ?? 1920),
    fps: Number(process.env.VIDEO_FPS ?? 30),
    chromiumExecutablePath:
      process.env.CHROMIUM_EXECUTABLE_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    renderTimeoutMs: Number(process.env.RENDER_TIMEOUT_MS ?? 300000),
  },
  edgeTts: {
    timeoutMs: Number(process.env.EDGE_TTS_TIMEOUT_MS ?? 30000),
  },
  visuals: {
    pixabayApiKey: process.env.PIXABAY_API_KEY,
    pexelsApiKey: process.env.PEXELS_API_KEY,
    maxVideoHeight: Number(process.env.VISUAL_MAX_VIDEO_HEIGHT ?? 720),
    maxImageWidth: Number(process.env.VISUAL_MAX_IMAGE_WIDTH ?? 1600),
    assetCacheDir: process.env.VISUAL_ASSET_CACHE_DIR ?? path.join(process.cwd(), "storage", "visual-cache"),
    requestTimeoutMs: Number(process.env.VISUAL_REQUEST_TIMEOUT_MS ?? 15000),
    maxAssetsPerJob: Number(process.env.VISUAL_MAX_ASSETS_PER_JOB ?? 60),
  },
  music: {
    musicAssetsDir: process.env.MUSIC_ASSETS_DIR ?? path.join(process.cwd(), "assets", "music"),
    sfxAssetsDir: process.env.SFX_ASSETS_DIR ?? path.join(process.cwd(), "assets", "sfx"),
    musicVolume: Number(process.env.MUSIC_VOLUME ?? 0.5),
    sfxVolume: Number(process.env.SFX_VOLUME ?? 0.7),
    jamendoClientId: process.env.JAMENDO_CLIENT_ID,
    jamendoClientSecret: process.env.JAMENDO_CLIENT_SECRET,
    jamendoCacheDir: process.env.JAMENDO_CACHE_DIR ?? path.join(process.cwd(), "storage", "jamendo-cache"),
    jamendoTimeoutMs: Number(process.env.JAMENDO_TIMEOUT_MS ?? 15000),
    jamendoDownloadTimeoutMs: Number(process.env.JAMENDO_DOWNLOAD_TIMEOUT_MS ?? 45000),
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    chatId: process.env.TELEGRAM_CHAT_ID,
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET,
  },
  youtube: {
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.YOUTUBE_REDIRECT_URI ?? `http://localhost:${Number(process.env.PORT ?? 4000)}/api/youtube/callback`,
    tokenStorePath: process.env.YOUTUBE_TOKEN_STORE_PATH ?? path.join(process.cwd(), "data", "youtubeToken.json"),
    frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:5173",
  },
};

export function isConfigured(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

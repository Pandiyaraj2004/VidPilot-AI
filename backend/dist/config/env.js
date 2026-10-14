import "dotenv/config";
import path from "node:path";
import { tmpdir } from "node:os";
const temporaryMediaRoot = process.env.MEDIA_TEMP_DIR ?? path.join(tmpdir(), "vidpilot-ai");
/**
 * Single read point for process.env. Nothing here is ever sent to the
 * frontend — routes/controllers should expose derived booleans
 * (e.g. "configured: true/false"), never the raw values.
 */
export const config = {
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
        openRouterModel: process.env.OPENROUTER_MODEL ?? "openrouter/free",
        requestTimeoutMs: Number(process.env.AI_REQUEST_TIMEOUT_MS ?? 45000),
    },
    piper: {
        executablePath: process.env.PIPER_EXECUTABLE_PATH ?? (process.platform === "win32" ? path.join(process.cwd(), "vendor", "piper", "piper.exe") : "/usr/local/bin/piper"),
        espeakDataPath: process.env.PIPER_ESPEAK_DATA_PATH ?? path.join(process.cwd(), "vendor", "piper", "espeak-ng-data"),
        voicesDir: process.env.PIPER_VOICES_DIR ?? path.join(process.cwd(), "vendor", "piper-voices"),
        storageDir: process.env.VOICE_STORAGE_DIR ?? path.join(temporaryMediaRoot, "jobs"),
        processTimeoutMs: Number(process.env.PIPER_TIMEOUT_MS ?? 30000),
    },
    ffmpeg: {
        ffmpegPath: process.env.FFMPEG_PATH ??
            (process.platform === "win32" ? path.join(process.cwd(), "vendor", "ffmpeg", "ffmpeg-n7.1-latest-win64-gpl-7.1", "bin", "ffmpeg.exe") : "/usr/bin/ffmpeg"),
        ffprobePath: process.env.FFPROBE_PATH ??
            (process.platform === "win32" ? path.join(process.cwd(), "vendor", "ffmpeg", "ffmpeg-n7.1-latest-win64-gpl-7.1", "bin", "ffprobe.exe") : "/usr/bin/ffprobe"),
        processTimeoutMs: Number(process.env.FFMPEG_TIMEOUT_MS ?? 120000),
    },
    rendering: {
        fontsDir: process.env.FONTS_DIR ?? path.join(process.cwd(), "assets", "fonts"),
        storageDir: process.env.VIDEO_STORAGE_DIR ?? path.join(temporaryMediaRoot, "jobs"),
        // Vertical Shorts by default — set VIDEO_WIDTH=1920/VIDEO_HEIGHT=1080 to
        // switch a deployment back to landscape; nothing else needs to change,
        // see remotion/Root.tsx's calculateMetadata.
        width: Number(process.env.VIDEO_WIDTH ?? 1080),
        height: Number(process.env.VIDEO_HEIGHT ?? 1920),
        fps: Number(process.env.VIDEO_FPS ?? 30),
        chromiumExecutablePath: process.env.CHROMIUM_EXECUTABLE_PATH ?? (process.platform === "win32" ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" : "/usr/bin/chromium"),
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
        assetCacheDir: process.env.VISUAL_ASSET_CACHE_DIR ?? path.join(temporaryMediaRoot, "visual-cache"),
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
        jamendoCacheDir: process.env.JAMENDO_CACHE_DIR ?? path.join(temporaryMediaRoot, "jamendo-cache"),
        jamendoTimeoutMs: Number(process.env.JAMENDO_TIMEOUT_MS ?? 15000),
        jamendoDownloadTimeoutMs: Number(process.env.JAMENDO_DOWNLOAD_TIMEOUT_MS ?? 45000),
    },
    youtube: {
        googleClientId: process.env.GOOGLE_CLIENT_ID,
        googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
        redirectUri: process.env.YOUTUBE_REDIRECT_URI ?? `http://localhost:${Number(process.env.PORT ?? 4000)}/api/youtube/callback`,
        tokenStorePath: process.env.YOUTUBE_TOKEN_STORE_PATH ?? path.join(process.cwd(), "data", "youtubeToken.json"),
        frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:5173",
    },
    supabase: {
        url: process.env.SUPABASE_URL,
        serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
};
export function isConfigured(value) {
    return typeof value === "string" && value.trim().length > 0;
}

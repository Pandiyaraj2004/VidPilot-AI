import "dotenv/config";

interface AppConfig {
  port: number;
  nodeEnv: string;
  firebase: {
    projectId: string | undefined;
    serviceAccountJson: string | undefined;
  };
  ai: {
    geminiApiKey: string | undefined;
    openRouterApiKey: string | undefined;
  };
  telegram: {
    botToken: string | undefined;
    chatId: string | undefined;
  };
  youtube: {
    googleClientId: string | undefined;
    googleClientSecret: string | undefined;
    refreshToken: string | undefined;
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
    openRouterApiKey: process.env.OPENROUTER_API_KEY,
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    chatId: process.env.TELEGRAM_CHAT_ID,
  },
  youtube: {
    googleClientId: process.env.GOOGLE_CLIENT_ID,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
    refreshToken: process.env.YOUTUBE_REFRESH_TOKEN,
  },
};

export function isConfigured(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

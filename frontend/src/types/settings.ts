export interface AppSettings {
  applicationName: string;
  language: string;
  defaultVoice: string;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  applicationName: "VidPilot AI",
  language: "en",
  defaultVoice: "default",
};

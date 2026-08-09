import { configStore } from "@/services/storage/configStore";
import { DEFAULT_APP_SETTINGS, type AppSettings } from "@/types";

const STORAGE_KEY = "vidpilot:app-settings";

export function getAppSettings(): AppSettings {
  return configStore.get(STORAGE_KEY, DEFAULT_APP_SETTINGS);
}

export function saveAppSettings(next: AppSettings): AppSettings {
  configStore.set(STORAGE_KEY, next);
  return next;
}

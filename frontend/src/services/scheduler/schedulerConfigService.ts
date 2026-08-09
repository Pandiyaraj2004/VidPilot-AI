import { configStore } from "@/services/storage/configStore";
import { DEFAULT_SCHEDULER_CONFIG, type SchedulerConfig } from "@/types";

const STORAGE_KEY = "vidpilot:scheduler-config";

export function getSchedulerConfig(): SchedulerConfig {
  return configStore.get(STORAGE_KEY, DEFAULT_SCHEDULER_CONFIG);
}

export function saveSchedulerConfig(next: SchedulerConfig): SchedulerConfig {
  configStore.set(STORAGE_KEY, next);
  return next;
}

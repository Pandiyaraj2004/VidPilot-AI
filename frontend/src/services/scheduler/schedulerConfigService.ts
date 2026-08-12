import { apiGet, apiPost } from "../api/client";
import type { SchedulerConfig } from "@/types";

export interface AutomationDetails {
  config: SchedulerConfig;
  history: Array<{
    timestamp: string;
    eventType: string;
    jobId?: string;
    topic?: string;
    category?: string;
    language?: string;
    voice?: string;
    storyStructure?: string;
    hookType?: string;
    targetDuration?: number;
    actualDuration?: number;
    musicTrack?: string;
    message?: string;
  }>;
}

export async function getAutomationState(): Promise<AutomationDetails> {
  return apiGet<AutomationDetails>("/automation");
}

export async function saveSchedulerConfig(next: Partial<SchedulerConfig>): Promise<SchedulerConfig> {
  // Post config patch to the backend router
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api"}/automation`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(next),
  });
  if (!response.ok) throw new Error("Failed to save scheduler config");
  return response.json() as Promise<SchedulerConfig>;
}

export async function triggerGenerationNow(): Promise<{ success: boolean; message: string }> {
  return apiPost<{ success: boolean; message: string }>("/automation/run-now");
}

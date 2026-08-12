import { apiGet, apiUrl, ApiError } from "@/services/api/client";
import type { VoiceOption } from "@/types";

export function listVoices(language?: string): Promise<VoiceOption[]> {
  const query = language ? `?language=${encodeURIComponent(language)}` : "";
  return apiGet<VoiceOption[]>(`/voices${query}`);
}

/**
 * Synthesizes and returns a short preview clip for the given voice/speed —
 * no job required. Bypasses the shared JSON-only apiPost helper since this
 * is the one endpoint that returns audio bytes, not JSON.
 */
export async function previewVoice(voiceId: string, speed: number): Promise<Blob> {
  const response = await fetch(apiUrl("/voices/preview"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ voiceId, speed }),
  });
  if (!response.ok) {
    throw new ApiError(response.status, `Unable to generate a voice preview (status ${response.status}).`);
  }
  return response.blob();
}

/** Playable URL for a scene's generated audio — built from IDs, never from a stored filesystem path. */
export function sceneAudioUrl(jobId: string, sceneId: string): string {
  return apiUrl(`/jobs/${encodeURIComponent(jobId)}/scenes/${encodeURIComponent(sceneId)}/audio`);
}

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { config } from "../../config/env.js";

/**
 * Local workspace for generated scene audio — `storage/jobs/{jobId}/audio/`.
 * This is processing-workspace storage, not permanent media storage: it's
 * how the current process hands audio off to the next pipeline stage
 * (Phase 5's renderer), not a durable asset store. Firestore/local job
 * data holds only the metadata (status, duration, format, this path) —
 * never the binary. On a throwaway environment (e.g. a CI runner) this
 * directory does not survive between unrelated runs; a future phase that
 * needs it to survive must add real persistent storage (e.g. Cloud
 * Storage) behind this same set of helpers, not bypass them.
 */
export function getJobAudioDir(jobId: string): string {
  return path.join(config.piper.storageDir, jobId, "audio");
}

function sceneFileName(sceneOrder: number): string {
  return `scene-${String(sceneOrder + 1).padStart(3, "0")}.wav`;
}

export function getSceneAudioPath(jobId: string, sceneOrder: number): string {
  return path.join(getJobAudioDir(jobId), sceneFileName(sceneOrder));
}

export async function ensureJobAudioDir(jobId: string): Promise<void> {
  await mkdir(getJobAudioDir(jobId), { recursive: true });
}

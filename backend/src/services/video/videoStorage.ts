import { mkdir } from "node:fs/promises";
import path from "node:path";
import { config } from "../../config/env.js";

/**
 * Per-scene render output and the final muxed video, both under the same
 * per-job workspace audioStorage.ts uses (`storage/jobs/{jobId}/...`) — a
 * processing workspace, not permanent media storage. Firestore/local job
 * data holds only metadata (status, duration, resolution, this path) —
 * never the binary. See audioStorage.ts for the fuller rationale.
 */
export function getJobRenderDir(jobId: string): string {
  return path.join(config.rendering.storageDir, jobId, "render");
}

export function getJobOutputDir(jobId: string): string {
  return path.join(config.rendering.storageDir, jobId, "output");
}

function sceneRenderFileName(sceneOrder: number): string {
  return `scene-${String(sceneOrder + 1).padStart(3, "0")}.mp4`;
}

export function getSceneRenderPath(jobId: string, sceneOrder: number): string {
  return path.join(getJobRenderDir(jobId), sceneRenderFileName(sceneOrder));
}

export function getFinalVideoPath(jobId: string): string {
  return path.join(getJobOutputDir(jobId), "final.mp4");
}

export async function ensureJobRenderDir(jobId: string): Promise<void> {
  await mkdir(getJobRenderDir(jobId), { recursive: true });
}

export async function ensureJobOutputDir(jobId: string): Promise<void> {
  await mkdir(getJobOutputDir(jobId), { recursive: true });
}

import { mkdir } from "node:fs/promises";
import fs from "node:fs";
import path from "node:path";
import { config } from "../../config/env.js";
import { isSupabaseConfigured } from "../supabase/index.js";
import { downloadFromSupabaseBucket } from "../supabase/storage.js";

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

/**
 * Checks if the video file path is a remote URL (starts with http). If so,
 * and it doesn't already exist locally, downloads it from Supabase Storage
 * (or fetch) to a local path in the job output folder and returns the local path.
 */
export async function ensureLocalVideoFile(jobId: string, pathOrUrl: string): Promise<string> {
  if (!pathOrUrl.startsWith("http://") && !pathOrUrl.startsWith("https://")) {
    return pathOrUrl; // Already a local path
  }

  const localPath = getFinalVideoPath(jobId);
  if (fs.existsSync(localPath)) {
    return localPath; // Already downloaded/exists locally
  }

  await ensureJobOutputDir(jobId);

  // If Supabase is configured, try downloading from the bucket first
  if (isSupabaseConfigured()) {
    try {
      const bucketPath = `${jobId}/final.mp4`;
      const buffer = await downloadFromSupabaseBucket("rendered-videos", bucketPath);
      await fs.promises.writeFile(localPath, buffer);
      return localPath;
    } catch (err) {
      console.warn(`[VidPilot] Failed to download video from Supabase bucket: ${(err as Error).message}. Falling back to fetch.`);
    }
  }

  // Fallback: direct HTTP fetch
  const response = await fetch(pathOrUrl);
  if (!response.ok) {
    throw new Error(`Failed to download remote video from ${pathOrUrl}: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  await fs.promises.writeFile(localPath, Buffer.from(arrayBuffer));
  return localPath;
}

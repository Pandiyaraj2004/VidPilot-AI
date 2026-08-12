/**
 * Real thumbnail rendering (Phase 11) — reuses the exact same Remotion
 * bundle/browser the main video renderer already builds (getBundleUrl,
 * withRenderBrowser in remotionRenderer.ts) rather than a second,
 * unrelated image-generation pipeline. A real background frame (extracted
 * from an already-downloaded, license-verified visual asset via ffmpeg —
 * never a fresh download) is composited with a short headline through the
 * "Thumbnail" Remotion composition (remotion/Thumbnail.tsx) and rendered
 * to a real 1280×720 JPEG via renderStill().
 */

import path from "node:path";
import { renderStill, selectComposition, type HeadlessBrowser } from "@remotion/renderer";
import { config } from "../../config/env.js";
import { runFfmpeg } from "../ffmpeg/ffmpegRunner.js";
import { cacheAssetPath, readCachedAsset } from "../visual/assetCache.js";
import { getJobOutputDir } from "../video/videoStorage.js";
import { getBundleUrl } from "../video/remotionRenderer.js";
import { planThumbnail } from "./thumbnailPlanner.js";
import type { ThumbnailAsset, VideoJob } from "../../types/index.js";

const COMPOSITION_ID = "Thumbnail";
const THUMBNAIL_WIDTH = 1280;
const THUMBNAIL_HEIGHT = 720;

export function getThumbnailSourcePath(jobId: string): string {
  return path.join(getJobOutputDir(jobId), "thumbnail-source.jpg");
}

export function getThumbnailPath(jobId: string): string {
  return path.join(getJobOutputDir(jobId), "thumbnail.jpg");
}

/** The backend's own real thumbnail-source route (see jobsController.ts) — the same "server resolves the path, client only supplies an id it already owns" convention as scene audio/visual asset serving. */
function thumbnailSourceUrl(jobId: string): string {
  return `http://localhost:${config.port}/api/jobs/${jobId}/thumbnail/source`;
}

/**
 * Extracts one real frame from the chosen background asset (video or
 * image — ffmpeg handles both identically) into a single normalized JPEG.
 * A fixed 1-second offset is safe: every visual asset used here already
 * passed Phase 5's real license/duration checks, and assets shorter than a
 * second fall back to ffmpeg clamping to the nearest available frame
 * rather than erroring.
 */
async function extractSourceFrame(sourceFilePath: string, outputPath: string): Promise<void> {
  await runFfmpeg(["-ss", "1", "-i", sourceFilePath, "-frames:v", "1", "-y", outputPath]);
}

export async function generateThumbnail(job: VideoJob, browser: HeadlessBrowser): Promise<ThumbnailAsset> {
  const plan = planThumbnail(job);
  let backgroundImageUrl: string | null = null;

  if (plan.sourceAsset) {
    const cached = await readCachedAsset(plan.sourceAsset.id);
    if (cached) {
      const sourceFilePath = cacheAssetPath(cached.id, cached.ext);
      const extractedPath = getThumbnailSourcePath(job.id);
      await extractSourceFrame(sourceFilePath, extractedPath);
      backgroundImageUrl = thumbnailSourceUrl(job.id);
    }
  }

  const serveUrl = await getBundleUrl();
  const inputProps = {
    width: THUMBNAIL_WIDTH,
    height: THUMBNAIL_HEIGHT,
    headline: plan.headline,
    language: job.language,
    colors: plan.colors,
    accentColor: plan.accentColor,
    backgroundImageUrl,
  };

  const composition = await selectComposition({
    serveUrl,
    id: COMPOSITION_ID,
    inputProps,
    puppeteerInstance: browser,
    timeoutInMilliseconds: config.rendering.renderTimeoutMs,
  });

  const outputPath = getThumbnailPath(job.id);
  await renderStill({
    composition,
    serveUrl,
    output: outputPath,
    inputProps,
    puppeteerInstance: browser,
    timeoutInMilliseconds: config.rendering.renderTimeoutMs,
    imageFormat: "jpeg",
    jpegQuality: 90,
  });

  return {
    status: "ready",
    path: outputPath,
    width: THUMBNAIL_WIDTH,
    height: THUMBNAIL_HEIGHT,
    fileSizeBytes: null, // filled in by the caller after validateThumbnail() reads the real file
    headline: plan.headline,
    sourceAssetId: plan.sourceAsset?.id ?? null,
    generatedAt: new Date().toISOString(),
    error: null,
  };
}

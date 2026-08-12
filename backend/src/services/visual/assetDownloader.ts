import { rm, stat } from "node:fs/promises";
import path from "node:path";
import { runFfprobe } from "../ffmpeg/ffmpegRunner.js";
import { cacheAssetId, cacheAssetPath, readCachedAsset, writeCachedAsset, type CacheMeta } from "./assetCache.js";
import type { AssetCandidate } from "./assetTypes.js";
import { downloadToFile } from "./providers/httpClient.js";

export class AssetDownloadError extends Error {}

interface ProbedMedia {
  width: number;
  height: number;
  durationSeconds: number | null;
}

/** Runs the downloaded file through ffprobe to confirm it's a real, decodable image/video and to read its true dimensions/duration — never trusts the provider's reported metadata or the file extension alone. Exported for direct testing against real fixture files (see assetDownloader.test.ts). */
export async function probeMedia(filePath: string, mediaType: "image" | "video"): Promise<ProbedMedia> {
  let raw: string;
  try {
    raw = await runFfprobe([
      "-v", "error",
      "-select_streams", "v:0",
      "-show_entries", "stream=width,height:format=duration",
      "-of", "json",
      filePath,
    ]);
  } catch (err) {
    throw new AssetDownloadError(`Downloaded ${mediaType} failed ffprobe validation: ${(err as Error).message}`);
  }

  let parsed: { streams?: { width?: number; height?: number }[]; format?: { duration?: string } };
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AssetDownloadError(`ffprobe returned unparseable output for a downloaded ${mediaType}.`);
  }

  const stream = parsed.streams?.[0];
  if (!stream?.width || !stream?.height) {
    throw new AssetDownloadError(`Downloaded ${mediaType} has no valid image/video stream — likely corrupt or truncated.`);
  }

  const durationSeconds = mediaType === "video" ? Number(parsed.format?.duration) : null;
  if (mediaType === "video" && (!durationSeconds || durationSeconds <= 0 || !Number.isFinite(durationSeconds))) {
    throw new AssetDownloadError("Downloaded video has no valid duration — likely corrupt or truncated.");
  }

  return { width: stream.width, height: stream.height, durationSeconds };
}

function extensionFor(url: string, mediaType: "image" | "video"): string {
  const pathname = new URL(url).pathname;
  const ext = path.extname(pathname).toLowerCase();
  if (ext && ext.length <= 5) return ext;
  return mediaType === "video" ? ".mp4" : ".jpg";
}

/**
 * Downloads (or reuses a cached copy of) one candidate. Throws
 * AssetDownloadError on any failure — the caller (assetSearchEngine) treats
 * that exactly like "no candidate available" and moves to the next tier;
 * it never fails the whole scene over one bad asset.
 */
export async function downloadAsset(candidate: AssetCandidate, query: string, timeoutMs: number): Promise<CacheMeta> {
  const id = cacheAssetId(candidate.provider, candidate.sourceId);

  const cached = await readCachedAsset(id);
  if (cached) return cached;

  const ext = extensionFor(candidate.downloadUrl, candidate.mediaType);
  const destPath = cacheAssetPath(id, ext);

  let fileSizeBytes: number;
  try {
    fileSizeBytes = await downloadToFile(candidate.downloadUrl, destPath, timeoutMs);
  } catch (err) {
    throw new AssetDownloadError(`Failed to download from ${candidate.provider}: ${(err as Error).message}`);
  }

  let probed: ProbedMedia;
  try {
    probed = await probeMedia(destPath, candidate.mediaType);
  } catch (err) {
    await rm(destPath, { force: true }).catch(() => undefined);
    throw err;
  }

  // Guard against a near-empty response body that ffprobe still happens to accept.
  const sizeCheck = await stat(destPath).catch(() => null);
  if (!sizeCheck || sizeCheck.size < 512) {
    await rm(destPath, { force: true }).catch(() => undefined);
    throw new AssetDownloadError("Downloaded asset is implausibly small — likely an error page, not real media.");
  }

  const meta: CacheMeta = {
    id,
    provider: candidate.provider,
    mediaType: candidate.mediaType,
    sourcePageUrl: candidate.sourcePageUrl,
    author: candidate.author,
    license: candidate.rawLicense,
    attributionRequired: candidate.attributionRequired,
    attributionText: candidate.attributionText,
    query,
    width: probed.width,
    height: probed.height,
    durationSeconds: probed.durationSeconds,
    downloadedAt: new Date().toISOString(),
    fileSizeBytes,
    ext,
  };

  await writeCachedAsset(meta);
  return meta;
}

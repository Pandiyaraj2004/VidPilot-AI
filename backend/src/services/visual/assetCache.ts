import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "../../config/env.js";
import type { VisualAssetMetadata, VisualSourceProvider } from "../../types/index.js";

/** Internal, on-disk cache record — a superset of the public VisualAssetMetadata (adds `ext`, needed to resolve the file on disk but never sent to the frontend). */
export interface CacheMeta extends VisualAssetMetadata {
  ext: string;
}

export function cacheAssetId(provider: VisualSourceProvider, sourceId: string): string {
  return createHash("sha1").update(`${provider}:${sourceId}`).digest("hex");
}

function cacheDirFor(assetId: string): string {
  return path.join(config.visuals.assetCacheDir, assetId);
}

export function cacheAssetPath(assetId: string, ext: string): string {
  return path.join(cacheDirFor(assetId), `asset${ext}`);
}

function cacheMetaPath(assetId: string): string {
  return path.join(cacheDirFor(assetId), "meta.json");
}

/** Returns the cached metadata if this exact source was already downloaded — the caller never re-downloads in that case, even across unrelated jobs/topics. */
export async function readCachedAsset(assetId: string): Promise<CacheMeta | null> {
  try {
    const raw = await readFile(cacheMetaPath(assetId), "utf-8");
    return JSON.parse(raw) as CacheMeta;
  } catch {
    return null;
  }
}

export async function writeCachedAsset(meta: CacheMeta): Promise<void> {
  await mkdir(cacheDirFor(meta.id), { recursive: true });
  await writeFile(cacheMetaPath(meta.id), JSON.stringify(meta, null, 2), "utf-8");
}

/** Strips cache-internal fields before this metadata is attached to a job record that the frontend will receive. */
export function toPublicMetadata(meta: CacheMeta): VisualAssetMetadata {
  const { ext, ...publicMeta } = meta;
  return publicMeta;
}

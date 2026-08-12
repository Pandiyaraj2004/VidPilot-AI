import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import fs from "node:fs";
import path from "node:path";
import { config } from "../../config/env.js";
import type { VisualAssetMetadata, VisualSourceProvider } from "../../types/index.js";
import { isSupabaseConfigured } from "../supabase/index.js";
import { uploadToSupabaseBucket, downloadFromSupabaseBucket } from "../supabase/storage.js";

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

const BUCKET = "visual-cache";

/** Returns the cached metadata if this exact source was already downloaded — the caller never re-downloads in that case, even across unrelated jobs/topics. */
export async function readCachedAsset(assetId: string): Promise<CacheMeta | null> {
  const metaPath = cacheMetaPath(assetId);

  // If local file is missing but Supabase is configured, try downloading from Supabase
  if (!fs.existsSync(metaPath) && isSupabaseConfigured()) {
    try {
      // 1. Download meta.json
      const metaBuf = await downloadFromSupabaseBucket(BUCKET, `${assetId}/meta.json`);
      const meta = JSON.parse(metaBuf.toString()) as CacheMeta;

      // 2. Download the media asset file
      const assetBuf = await downloadFromSupabaseBucket(BUCKET, `${assetId}/asset${meta.ext}`);

      // 3. Save both locally so the local video render engine can access them
      await mkdir(cacheDirFor(assetId), { recursive: true });
      await writeFile(metaPath, JSON.stringify(meta, null, 2), "utf-8");
      await writeFile(cacheAssetPath(assetId, meta.ext), assetBuf);

      return meta;
    } catch {
      return null;
    }
  }

  try {
    const raw = await readFile(metaPath, "utf-8");
    return JSON.parse(raw) as CacheMeta;
  } catch {
    return null;
  }
}

export async function writeCachedAsset(meta: CacheMeta): Promise<void> {
  const metaPath = cacheMetaPath(meta.id);
  const mediaPath = cacheAssetPath(meta.id, meta.ext);

  await mkdir(cacheDirFor(meta.id), { recursive: true });
  await writeFile(metaPath, JSON.stringify(meta, null, 2), "utf-8");

  // If Supabase is configured, upload both metadata and media to the visual-cache bucket
  if (isSupabaseConfigured()) {
    try {
      await uploadToSupabaseBucket(BUCKET, metaPath, `${meta.id}/meta.json`);
      if (fs.existsSync(mediaPath)) {
        await uploadToSupabaseBucket(BUCKET, mediaPath, `${meta.id}/asset${meta.ext}`);
      }
    } catch (err) {
      console.error(`[VidPilot] Failed to upload cached asset ${meta.id} to Supabase: ${(err as Error).message}`);
    }
  }
}

/** Strips cache-internal fields before this metadata is attached to a job record that the frontend will receive. */
export function toPublicMetadata(meta: CacheMeta): VisualAssetMetadata {
  const { ext, ...publicMeta } = meta;
  return publicMeta;
}

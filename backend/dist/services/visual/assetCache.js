import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import fs from "node:fs";
import path from "node:path";
import { config } from "../../config/env.js";
import { isSupabaseConfigured } from "../supabase/index.js";
import { downloadFromSupabaseBucket } from "../supabase/storage.js";
export function cacheAssetId(provider, sourceId) {
    return createHash("sha1").update(`${provider}:${sourceId}`).digest("hex");
}
function cacheDirFor(assetId) {
    return path.join(config.visuals.assetCacheDir, assetId);
}
export function cacheAssetPath(assetId, ext) {
    return path.join(cacheDirFor(assetId), `asset${ext}`);
}
function cacheMetaPath(assetId) {
    return path.join(cacheDirFor(assetId), "meta.json");
}
const BUCKET = "visual-cache";
/** Returns the cached metadata if this exact source was already downloaded — the caller never re-downloads in that case, even across unrelated jobs/topics. */
export async function readCachedAsset(assetId) {
    const metaPath = cacheMetaPath(assetId);
    // If local file is missing but Supabase is configured, try downloading from Supabase
    if (!fs.existsSync(metaPath) && isSupabaseConfigured()) {
        try {
            // 1. Download meta.json
            const metaBuf = await downloadFromSupabaseBucket(BUCKET, `${assetId}/meta.json`);
            const meta = JSON.parse(metaBuf.toString());
            // 2. Download the media asset file
            const assetBuf = await downloadFromSupabaseBucket(BUCKET, `${assetId}/asset${meta.ext}`);
            // 3. Save both locally so the local video render engine can access them
            await mkdir(cacheDirFor(assetId), { recursive: true });
            await writeFile(metaPath, JSON.stringify(meta, null, 2), "utf-8");
            await writeFile(cacheAssetPath(assetId, meta.ext), assetBuf);
            return meta;
        }
        catch {
            return null;
        }
    }
    try {
        const raw = await readFile(metaPath, "utf-8");
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
export async function writeCachedAsset(meta) {
    const metaPath = cacheMetaPath(meta.id);
    await mkdir(cacheDirFor(meta.id), { recursive: true });
    await writeFile(metaPath, JSON.stringify(meta, null, 2), "utf-8");
}
/** Strips cache-internal fields before this metadata is attached to a job record that the frontend will receive. */
export function toPublicMetadata(meta) {
    const { ext, ...publicMeta } = meta;
    return publicMeta;
}

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { config } from "../../config/env.js";
import { cacheAssetId, cacheAssetPath, readCachedAsset, toPublicMetadata, writeCachedAsset, type CacheMeta } from "./assetCache.js";

function makeMeta(overrides: Partial<CacheMeta> = {}): CacheMeta {
  return {
    id: cacheAssetId("pixabay", "12345"),
    provider: "pixabay",
    mediaType: "video",
    sourcePageUrl: "https://pixabay.com/videos/x-12345/",
    author: "someone",
    license: "Pixabay Content License",
    attributionRequired: false,
    attributionText: null,
    query: "human brain",
    width: 1280,
    height: 720,
    durationSeconds: 6.4,
    downloadedAt: new Date().toISOString(),
    fileSizeBytes: 4096,
    ext: ".mp4",
    ...overrides,
  };
}

describe("assetCache", () => {
  let originalCacheDir: string;
  let tempDir: string;

  beforeEach(() => {
    originalCacheDir = config.visuals.assetCacheDir;
    tempDir = mkdtempSync(path.join(tmpdir(), "vidpilot-visual-cache-test-"));
    config.visuals.assetCacheDir = tempDir;
  });

  afterEach(() => {
    config.visuals.assetCacheDir = originalCacheDir;
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("cacheAssetId is deterministic for the same provider+sourceId", () => {
    expect(cacheAssetId("pixabay", "12345")).toBe(cacheAssetId("pixabay", "12345"));
  });

  it("cacheAssetId differs across providers for the same sourceId (no cross-provider collision)", () => {
    expect(cacheAssetId("pixabay", "12345")).not.toBe(cacheAssetId("pexels", "12345"));
  });

  it("returns null for an asset that has never been cached", async () => {
    const result = await readCachedAsset(cacheAssetId("pixabay", "does-not-exist"));
    expect(result).toBeNull();
  });

  it("round-trips a written asset — the same source is never re-downloaded once cached", async () => {
    const meta = makeMeta();
    await writeCachedAsset(meta);

    const read = await readCachedAsset(meta.id);
    expect(read).toEqual(meta);
  });

  it("resolves a stable file path for a given asset id and extension", () => {
    const p1 = cacheAssetPath("abc123", ".mp4");
    const p2 = cacheAssetPath("abc123", ".mp4");
    expect(p1).toBe(p2);
    expect(p1.endsWith("asset.mp4")).toBe(true);
  });

  it("toPublicMetadata strips the cache-internal 'ext' field before it reaches a job record", () => {
    const meta = makeMeta();
    const publicMeta = toPublicMetadata(meta);
    expect(publicMeta).not.toHaveProperty("ext");
    expect(publicMeta.id).toBe(meta.id);
    expect(publicMeta.provider).toBe(meta.provider);
  });
});

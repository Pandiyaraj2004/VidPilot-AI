import { describe, it, expect, vi } from "vitest";
import type { CacheMeta } from "./assetCache.js";
import { AssetDownloadError } from "./assetDownloader.js";
import { findAssetForQuery, type AssetSearchEngineDeps } from "./assetSearchEngine.js";
import type { AssetCandidate, AssetProvider, AssetSearchOptions } from "./assetTypes.js";

function makeCandidate(provider: AssetCandidate["provider"], sourceId: string, mediaType: "image" | "video" = "video"): AssetCandidate {
  return {
    provider,
    mediaType,
    sourceId,
    downloadUrl: `https://example.test/${provider}/${sourceId}`,
    sourcePageUrl: `https://example.test/${provider}/page/${sourceId}`,
    author: "tester",
    width: 1280,
    height: 720,
    durationSeconds: mediaType === "video" ? 5 : null,
    rawLicense: "Test License",
    attributionRequired: false,
    attributionText: null,
  };
}

function fakeProvider(name: AssetProvider["name"], candidates: { videos?: AssetCandidate[]; images?: AssetCandidate[] }): AssetProvider {
  return {
    name,
    supportsVideo: Boolean(candidates.videos),
    supportsImages: Boolean(candidates.images),
    searchVideos: candidates.videos ? async () => candidates.videos! : undefined,
    searchImages: candidates.images ? async () => candidates.images! : undefined,
  };
}

const OPTIONS: AssetSearchOptions = { maxVideoHeight: 720, maxImageWidth: 1600, excludeSourceKeys: new Set() };

function fakeMeta(overrides: Partial<CacheMeta> = {}): CacheMeta {
  return {
    id: "hash-1",
    provider: "pixabay",
    mediaType: "video",
    sourcePageUrl: "https://example.test",
    author: "tester",
    license: "Test License",
    attributionRequired: false,
    attributionText: null,
    query: "test",
    width: 1280,
    height: 720,
    durationSeconds: 5,
    downloadedAt: new Date().toISOString(),
    fileSizeBytes: 1024,
    ext: ".mp4",
    ...overrides,
  };
}

describe("findAssetForQuery — priority chain", () => {
  it("prefers Pixabay video over every other tier when it succeeds", async () => {
    const deps: AssetSearchEngineDeps = {
      pixabay: fakeProvider("pixabay", { videos: [makeCandidate("pixabay", "1")], images: [makeCandidate("pixabay", "2", "image")] }),
      pexels: fakeProvider("pexels", { videos: [makeCandidate("pexels", "3")] }),
      wikimedia: fakeProvider("wikimedia", { images: [] }),
    };
    const download = vi.fn(async () => fakeMeta({ provider: "pixabay" }));

    const result = await findAssetForQuery(deps, "brain", OPTIONS, 5000, download);

    expect(result?.meta.provider).toBe("pixabay");
    expect(result?.sourceKey).toBe("pixabay:1");
    expect(download).toHaveBeenCalledTimes(1);
  });

  it("falls to Pexels video when Pixabay video has no candidates", async () => {
    const deps: AssetSearchEngineDeps = {
      pixabay: fakeProvider("pixabay", { videos: [], images: [] }),
      pexels: fakeProvider("pexels", { videos: [makeCandidate("pexels", "9")] }),
      wikimedia: null,
    };
    const download = vi.fn(async (candidate: AssetCandidate) => fakeMeta({ provider: candidate.provider }));

    const result = await findAssetForQuery(deps, "brain", OPTIONS, 5000, download);
    expect(result?.meta.provider).toBe("pexels");
  });

  it("falls all the way to Wikimedia images when every video tier is empty", async () => {
    const deps: AssetSearchEngineDeps = {
      pixabay: fakeProvider("pixabay", { videos: [], images: [] }),
      pexels: fakeProvider("pexels", { videos: [] }),
      wikimedia: fakeProvider("wikimedia", { images: [makeCandidate("wikimedia", "File:x.jpg", "image")] }),
    };
    const download = vi.fn(async (candidate: AssetCandidate) => fakeMeta({ provider: candidate.provider, mediaType: "image" }));

    const result = await findAssetForQuery(deps, "brain", OPTIONS, 5000, download);
    expect(result?.meta.provider).toBe("wikimedia");
  });

  it("returns null (procedural fallback) when every tier is empty", async () => {
    const deps: AssetSearchEngineDeps = {
      pixabay: fakeProvider("pixabay", { videos: [], images: [] }),
      pexels: fakeProvider("pexels", { videos: [] }),
      wikimedia: fakeProvider("wikimedia", { images: [] }),
    };
    const result = await findAssetForQuery(deps, "brain", OPTIONS, 5000);
    expect(result).toBeNull();
  });

  it("discards an unusable candidate and tries the next one, never failing the whole search", async () => {
    const deps: AssetSearchEngineDeps = {
      pixabay: fakeProvider("pixabay", { videos: [makeCandidate("pixabay", "bad"), makeCandidate("pixabay", "good")] }),
      pexels: null,
      wikimedia: null,
    };
    const download = vi.fn(async (candidate: AssetCandidate) => {
      if (candidate.sourceId === "bad") throw new AssetDownloadError("corrupt file");
      return fakeMeta({ provider: candidate.provider });
    });

    const result = await findAssetForQuery(deps, "brain", OPTIONS, 5000, download);
    expect(result?.sourceKey).toBe("pixabay:good");
    expect(download).toHaveBeenCalledTimes(2);
  });

  it("skips a provider entirely when a real search call throws (network error), moving to the next tier", async () => {
    const deps: AssetSearchEngineDeps = {
      pixabay: { name: "pixabay", supportsVideo: true, supportsImages: false, searchVideos: async () => { throw new Error("network down"); } },
      pexels: fakeProvider("pexels", { videos: [makeCandidate("pexels", "1")] }),
      wikimedia: null,
    };
    const download = vi.fn(async (candidate: AssetCandidate) => fakeMeta({ provider: candidate.provider }));

    const result = await findAssetForQuery(deps, "brain", OPTIONS, 5000, download);
    expect(result?.meta.provider).toBe("pexels");
  });

  it("respects excludeSourceKeys for in-job repetition avoidance", async () => {
    const excludeSourceKeys = new Set(["pixabay:1"]);
    const deps: AssetSearchEngineDeps = {
      // A real provider would itself filter by excludeSourceKeys — this fake simulates that filtering.
      pixabay: fakeProvider("pixabay", { videos: [] }),
      pexels: fakeProvider("pexels", { videos: [makeCandidate("pexels", "2")] }),
      wikimedia: null,
    };
    const download = vi.fn(async (candidate: AssetCandidate) => fakeMeta({ provider: candidate.provider }));

    const result = await findAssetForQuery(deps, "brain", { ...OPTIONS, excludeSourceKeys }, 5000, download);
    expect(result?.sourceKey).toBe("pexels:2");
  });
});

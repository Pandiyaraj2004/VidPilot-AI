/**
 * The Phase 5 priority chain: Pixabay Videos -> Pexels Videos -> Pixabay
 * Images -> Wikimedia Images -> null (the caller falls back to a
 * procedural background). Each tier is tried with a handful of candidates
 * before moving on — a bad/unlicensed/corrupt candidate never stops the
 * search, it just tries the next one, then the next tier.
 */
import { AssetDownloadError, downloadAsset } from "./assetDownloader.js";
const MAX_CANDIDATES_TRIED_PER_TIER = 5;
function buildTiers(deps) {
    return [
        { provider: deps.pixabay, search: (p, q, o) => p.searchVideos(q, o) },
        { provider: deps.pexels, search: (p, q, o) => p.searchVideos(q, o) },
        { provider: deps.pixabay, search: (p, q, o) => p.searchImages(q, o) },
        { provider: deps.wikimedia, search: (p, q, o) => p.searchImages(q, o) },
    ];
}
/**
 * Tries each tier in priority order for one query. Returns the first
 * successfully downloaded + validated + licensed asset, or null if every
 * tier came up empty (the caller then uses a procedural fallback).
 */
export async function findAssetForQuery(deps, query, options, timeoutMs, download = downloadAsset) {
    const tiers = buildTiers(deps);
    for (const tier of tiers) {
        if (!tier.provider)
            continue;
        let candidates;
        try {
            candidates = await tier.search(tier.provider, query, options);
        }
        catch (err) {
            console.error(`[VidPilot] Visual search failed for provider ${tier.provider.name}: ${err.message}`);
            continue;
        }
        for (const candidate of candidates.slice(0, MAX_CANDIDATES_TRIED_PER_TIER)) {
            try {
                const meta = await download(candidate, query, timeoutMs);
                return { meta, sourceKey: `${candidate.provider}:${candidate.sourceId}` };
            }
            catch (err) {
                if (err instanceof AssetDownloadError) {
                    console.error(`[VidPilot] Discarding unusable ${candidate.provider} asset ${candidate.sourceId}: ${err.message}`);
                    continue;
                }
                throw err;
            }
        }
    }
    return null;
}

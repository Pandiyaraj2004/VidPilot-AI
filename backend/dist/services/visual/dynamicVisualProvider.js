/**
 * The Phase 5 upgrade's default VisualProvider. Delegates the procedural
 * planning (segment count, timing, palette, motion, transition, overlays —
 * all deterministic, no network) to LocalVisualProvider, then attempts to
 * replace each segment's procedural background with a real, licensed
 * Pixabay/Pexels/Wikimedia asset. A segment that can't get a real asset
 * (no candidates, rejected license, download/validation failure) simply
 * keeps its procedural background — the scene never fails because of an
 * internet lookup; see visualEngine.ts for the per-scene retry contract
 * this still has to satisfy.
 */
import { config, isConfigured } from "../../config/env.js";
import { findAssetForQuery } from "./assetSearchEngine.js";
import { toPublicMetadata } from "./assetCache.js";
import { LocalVisualProvider } from "./localVisualProvider.js";
import { PexelsProvider } from "./providers/pexelsProvider.js";
import { PixabayProvider } from "./providers/pixabayProvider.js";
import { WikimediaProvider } from "./providers/wikimediaProvider.js";
import { buildSegmentQueries } from "./visualQueryBuilder.js";
function buildDefaultDeps() {
    const timeoutMs = config.visuals.requestTimeoutMs;
    return {
        pixabay: isConfigured(config.visuals.pixabayApiKey) ? new PixabayProvider(config.visuals.pixabayApiKey, timeoutMs) : null,
        pexels: isConfigured(config.visuals.pexelsApiKey) ? new PexelsProvider(config.visuals.pexelsApiKey, timeoutMs) : null,
        wikimedia: new WikimediaProvider(timeoutMs),
    };
}
export class DynamicVisualProvider {
    deps;
    local;
    name = "dynamic-internet";
    constructor(deps = buildDefaultDeps(), local = new LocalVisualProvider()) {
        this.deps = deps;
        this.local = local;
    }
    async generateVisual(input) {
        const base = await this.local.generateVisual(input);
        // No segments means no audio duration yet (voice not generated) — the
        // legacy single-background fallback applies; nothing to source footage for.
        if (!base.segments || base.segments.length === 0) {
            return base;
        }
        if (input.skipInternetSearch) {
            return { ...base, segments: base.segments.map((s) => ({ ...s, mediaKind: "color", fallbackUsed: true })) };
        }
        const queries = buildSegmentQueries({ visualKeywords: input.visualKeywords, visualDescription: input.visualDescription, narration: input.narration }, base.segments.length);
        const excludeSourceKeys = new Set(input.recentSourceKeys ?? []);
        const usedSourceKeys = [];
        const assetsById = new Map();
        const searchOptions = {
            maxVideoHeight: config.visuals.maxVideoHeight,
            maxImageWidth: config.visuals.maxImageWidth,
            excludeSourceKeys,
        };
        const segments = await Promise.all(base.segments.map(async (segment, i) => {
            const query = queries[i];
            let result = null;
            try {
                result = await findAssetForQuery(this.deps, query, searchOptions, config.visuals.requestTimeoutMs);
            }
            catch (err) {
                console.error(`[VidPilot] Visual asset search errored for scene ${input.sceneId} segment ${i}: ${err.message}`);
            }
            if (!result) {
                return { ...segment, mediaKind: "color", fallbackUsed: true };
            }
            excludeSourceKeys.add(result.sourceKey);
            usedSourceKeys.push(result.sourceKey);
            assetsById.set(result.meta.id, toPublicMetadata(result.meta));
            return {
                ...segment,
                mediaKind: result.meta.mediaType,
                assetId: result.meta.id,
                fallbackUsed: false,
            };
        }));
        return {
            ...base,
            segments,
            assets: Array.from(assetsById.values()),
            usedSourceKeys,
        };
    }
}

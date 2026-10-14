import { decidePixabayLicense } from "../visualLicense.js";
import { fetchJsonWithTimeout, rateGate } from "./httpClient.js";
const SEARCH_URL_VIDEOS = "https://pixabay.com/api/videos/";
const SEARCH_URL_IMAGES = "https://pixabay.com/api/";
const MIN_INTERVAL_MS = 600; // well under Pixabay's 100 req/min limit
/** Picks the smallest variant whose height still clears `minHeight`, falling back to the largest available when every variant is smaller than that. Keeps downloads fast without settling for unusably tiny footage. */
function pickVideoVariant(videos, maxHeight) {
    const variants = Object.values(videos).filter((v) => v && v.url);
    if (variants.length === 0)
        return null;
    const sorted = [...variants].sort((a, b) => a.height - b.height);
    const fitting = sorted.find((v) => v.height >= 360 && v.height <= maxHeight);
    return fitting ?? sorted[sorted.length - 1];
}
export class PixabayProvider {
    apiKey;
    timeoutMs;
    name = "pixabay";
    supportsVideo = true;
    supportsImages = true;
    constructor(apiKey, timeoutMs) {
        this.apiKey = apiKey;
        this.timeoutMs = timeoutMs;
    }
    async searchVideos(query, options) {
        await rateGate("pixabay", MIN_INTERVAL_MS);
        const url = `${SEARCH_URL_VIDEOS}?key=${encodeURIComponent(this.apiKey)}&q=${encodeURIComponent(query)}&per_page=20&safesearch=true`;
        const data = (await fetchJsonWithTimeout(url, this.timeoutMs));
        const license = decidePixabayLicense();
        return (data.hits ?? [])
            .filter((hit) => !options.excludeSourceKeys.has(`pixabay:${hit.id}`))
            .map((hit) => {
            const variant = pickVideoVariant(hit.videos, options.maxVideoHeight);
            if (!variant)
                return null;
            const candidate = {
                provider: "pixabay",
                mediaType: "video",
                sourceId: String(hit.id),
                downloadUrl: variant.url,
                sourcePageUrl: hit.pageURL,
                author: hit.user || null,
                width: variant.width,
                height: variant.height,
                durationSeconds: hit.duration || null,
                rawLicense: license.license,
                attributionRequired: license.attributionRequired,
                attributionText: license.attributionText,
            };
            return candidate;
        })
            .filter((c) => c !== null);
    }
    async searchImages(query, options) {
        await rateGate("pixabay", MIN_INTERVAL_MS);
        const url = `${SEARCH_URL_IMAGES}?key=${encodeURIComponent(this.apiKey)}&q=${encodeURIComponent(query)}&image_type=photo&per_page=20&safesearch=true`;
        const data = (await fetchJsonWithTimeout(url, this.timeoutMs));
        const license = decidePixabayLicense();
        return (data.hits ?? [])
            .filter((hit) => !options.excludeSourceKeys.has(`pixabay:${hit.id}`))
            .map((hit) => {
            const useOriginal = hit.imageWidth <= options.maxImageWidth;
            return {
                provider: "pixabay",
                mediaType: "image",
                sourceId: String(hit.id),
                downloadUrl: useOriginal ? hit.largeImageURL : hit.webformatURL,
                sourcePageUrl: hit.pageURL,
                author: hit.user || null,
                width: useOriginal ? hit.imageWidth : hit.webformatWidth,
                height: useOriginal ? hit.imageHeight : hit.webformatHeight,
                durationSeconds: null,
                rawLicense: license.license,
                attributionRequired: license.attributionRequired,
                attributionText: license.attributionText,
            };
        });
    }
}

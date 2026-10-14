import { decidePexelsLicense } from "../visualLicense.js";
import { fetchJsonWithTimeout, rateGate } from "./httpClient.js";
const SEARCH_URL_VIDEOS = "https://api.pexels.com/videos/search";
const SEARCH_URL_IMAGES = "https://api.pexels.com/v1/search";
const MIN_INTERVAL_MS = 1200; // conservative for Pexels' free-tier hourly limit
function pickVideoFile(files, maxHeight) {
    const mp4Files = files.filter((f) => f.file_type === "video/mp4" && f.link);
    if (mp4Files.length === 0)
        return null;
    const sorted = [...mp4Files].sort((a, b) => a.height - b.height);
    const fitting = sorted.find((f) => f.height >= 360 && f.height <= maxHeight);
    return fitting ?? sorted[sorted.length - 1];
}
export class PexelsProvider {
    apiKey;
    timeoutMs;
    name = "pexels";
    supportsVideo = true;
    supportsImages = true;
    constructor(apiKey, timeoutMs) {
        this.apiKey = apiKey;
        this.timeoutMs = timeoutMs;
    }
    get headers() {
        return { Authorization: this.apiKey };
    }
    async searchVideos(query, options) {
        await rateGate("pexels", MIN_INTERVAL_MS);
        const url = `${SEARCH_URL_VIDEOS}?query=${encodeURIComponent(query)}&per_page=15`;
        const data = (await fetchJsonWithTimeout(url, this.timeoutMs, this.headers));
        const license = decidePexelsLicense();
        return (data.videos ?? [])
            .filter((hit) => !options.excludeSourceKeys.has(`pexels:${hit.id}`))
            .map((hit) => {
            const file = pickVideoFile(hit.video_files, options.maxVideoHeight);
            if (!file)
                return null;
            return {
                provider: "pexels",
                mediaType: "video",
                sourceId: String(hit.id),
                downloadUrl: file.link,
                sourcePageUrl: hit.url,
                author: hit.user?.name || null,
                width: file.width,
                height: file.height,
                durationSeconds: hit.duration || null,
                rawLicense: license.license,
                attributionRequired: license.attributionRequired,
                attributionText: license.attributionText,
            };
        })
            .filter((c) => c !== null);
    }
    async searchImages(query, options) {
        await rateGate("pexels", MIN_INTERVAL_MS);
        const url = `${SEARCH_URL_IMAGES}?query=${encodeURIComponent(query)}&per_page=15`;
        const data = (await fetchJsonWithTimeout(url, this.timeoutMs, this.headers));
        const license = decidePexelsLicense();
        return (data.photos ?? [])
            .filter((hit) => !options.excludeSourceKeys.has(`pexels:${hit.id}`))
            .map((hit) => {
            const useLarge2x = hit.width <= options.maxImageWidth;
            return {
                provider: "pexels",
                mediaType: "image",
                sourceId: String(hit.id),
                downloadUrl: useLarge2x ? hit.src.large2x : hit.src.large,
                sourcePageUrl: hit.url,
                author: hit.photographer || null,
                width: hit.width,
                height: hit.height,
                durationSeconds: null,
                rawLicense: license.license,
                attributionRequired: license.attributionRequired,
                attributionText: license.attributionText,
            };
        });
    }
}

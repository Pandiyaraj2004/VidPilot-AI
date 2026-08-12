import type { AssetCandidate, AssetProvider, AssetSearchOptions } from "../assetTypes.js";
import { decidePexelsLicense } from "../visualLicense.js";
import { fetchJsonWithTimeout, rateGate } from "./httpClient.js";

const SEARCH_URL_VIDEOS = "https://api.pexels.com/videos/search";
const SEARCH_URL_IMAGES = "https://api.pexels.com/v1/search";
const MIN_INTERVAL_MS = 1200; // conservative for Pexels' free-tier hourly limit

interface PexelsVideoFile {
  id: number;
  quality: string;
  file_type: string;
  width: number;
  height: number;
  link: string;
}

interface PexelsVideoHit {
  id: number;
  url: string;
  duration: number;
  user: { name: string };
  video_files: PexelsVideoFile[];
}

interface PexelsPhotoHit {
  id: number;
  url: string;
  width: number;
  height: number;
  photographer: string;
  src: { original: string; large2x: string; large: string; medium: string };
}

function pickVideoFile(files: PexelsVideoFile[], maxHeight: number): PexelsVideoFile | null {
  const mp4Files = files.filter((f) => f.file_type === "video/mp4" && f.link);
  if (mp4Files.length === 0) return null;
  const sorted = [...mp4Files].sort((a, b) => a.height - b.height);
  const fitting = sorted.find((f) => f.height >= 360 && f.height <= maxHeight);
  return fitting ?? sorted[sorted.length - 1];
}

export class PexelsProvider implements AssetProvider {
  readonly name = "pexels" as const;
  readonly supportsVideo = true;
  readonly supportsImages = true;

  constructor(private readonly apiKey: string, private readonly timeoutMs: number) {}

  private get headers(): Record<string, string> {
    return { Authorization: this.apiKey };
  }

  async searchVideos(query: string, options: AssetSearchOptions): Promise<AssetCandidate[]> {
    await rateGate("pexels", MIN_INTERVAL_MS);
    const url = `${SEARCH_URL_VIDEOS}?query=${encodeURIComponent(query)}&per_page=15`;
    const data = (await fetchJsonWithTimeout(url, this.timeoutMs, this.headers)) as { videos?: PexelsVideoHit[] };
    const license = decidePexelsLicense();

    return (data.videos ?? [])
      .filter((hit) => !options.excludeSourceKeys.has(`pexels:${hit.id}`))
      .map((hit): AssetCandidate | null => {
        const file = pickVideoFile(hit.video_files, options.maxVideoHeight);
        if (!file) return null;
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
      .filter((c): c is AssetCandidate => c !== null);
  }

  async searchImages(query: string, options: AssetSearchOptions): Promise<AssetCandidate[]> {
    await rateGate("pexels", MIN_INTERVAL_MS);
    const url = `${SEARCH_URL_IMAGES}?query=${encodeURIComponent(query)}&per_page=15`;
    const data = (await fetchJsonWithTimeout(url, this.timeoutMs, this.headers)) as { photos?: PexelsPhotoHit[] };
    const license = decidePexelsLicense();

    return (data.photos ?? [])
      .filter((hit) => !options.excludeSourceKeys.has(`pexels:${hit.id}`))
      .map((hit): AssetCandidate => {
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

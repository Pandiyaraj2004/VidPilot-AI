import type { AssetCandidate, AssetProvider, AssetSearchOptions } from "../assetTypes.js";
import { decideWikimediaLicense } from "../visualLicense.js";
import { fetchJsonWithTimeout, rateGate } from "./httpClient.js";

const API_URL = "https://commons.wikimedia.org/w/api.php";
const MIN_INTERVAL_MS = 1000;
const USER_AGENT = "VidPilotAI/1.0 (personal single-user video project; contact via project owner)";

interface WikimediaSearchResult {
  query?: { search?: { title: string }[] };
}

interface WikimediaImageInfo {
  url: string;
  width: number;
  height: number;
  size: number;
  thumburl?: string;
  thumbwidth?: number;
  thumbheight?: number;
  extmetadata?: {
    LicenseShortName?: { value: string };
    UsageTerms?: { value: string };
    Artist?: { value: string };
  };
}

interface WikimediaPageInfo {
  query?: { pages?: Record<string, { title: string; imageinfo?: WikimediaImageInfo[] }> };
}

/** Strips the HTML Wikimedia's Artist/Credit fields commonly wrap plain text in (e.g. `<a href="...">Name</a>`). */
function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, "").trim();
}

export class WikimediaProvider implements AssetProvider {
  readonly name = "wikimedia" as const;
  readonly supportsVideo = false;
  readonly supportsImages = true;

  constructor(private readonly timeoutMs: number) {}

  async searchImages(query: string, options: AssetSearchOptions): Promise<AssetCandidate[]> {
    await rateGate("wikimedia", MIN_INTERVAL_MS);
    const searchUrl = `${API_URL}?action=query&list=search&srnamespace=6&srlimit=10&format=json&srsearch=${encodeURIComponent(
      `${query} filetype:bitmap`
    )}`;
    const searchData = (await fetchJsonWithTimeout(searchUrl, this.timeoutMs, { "User-Agent": USER_AGENT })) as WikimediaSearchResult;
    const titles = (searchData.query?.search ?? []).map((r) => r.title);
    if (titles.length === 0) return [];

    await rateGate("wikimedia", MIN_INTERVAL_MS);
    const infoUrl = `${API_URL}?action=query&titles=${encodeURIComponent(
      titles.join("|")
    )}&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=${options.maxImageWidth}&format=json`;
    const infoData = (await fetchJsonWithTimeout(infoUrl, this.timeoutMs, { "User-Agent": USER_AGENT })) as WikimediaPageInfo;
    const pages = Object.values(infoData.query?.pages ?? {});

    const candidates: AssetCandidate[] = [];
    for (const page of pages) {
      const info = page.imageinfo?.[0];
      if (!info || !info.url) continue;
      const sourceId = page.title;
      if (options.excludeSourceKeys.has(`wikimedia:${sourceId}`)) continue;

      const rawLicense = info.extmetadata?.LicenseShortName?.value ?? info.extmetadata?.UsageTerms?.value ?? "";
      const author = info.extmetadata?.Artist?.value ? stripHtml(info.extmetadata.Artist.value) : null;
      const sourcePageUrl = `https://commons.wikimedia.org/wiki/${encodeURIComponent(sourceId)}`;
      const decision = decideWikimediaLicense(rawLicense, author, sourcePageUrl);
      if (!decision.allowed) continue; // rejected — never guess, treat exactly like "no result"

      const fitsWidth = info.width <= options.maxImageWidth;
      const downloadUrl = fitsWidth || !info.thumburl ? info.url : info.thumburl;
      const width = fitsWidth || !info.thumbwidth ? info.width : info.thumbwidth;
      const height = fitsWidth || !info.thumbheight ? info.height : info.thumbheight;
      candidates.push({
        provider: "wikimedia",
        mediaType: "image",
        sourceId,
        downloadUrl,
        sourcePageUrl,
        author,
        width,
        height,
        durationSeconds: null,
        rawLicense: decision.license,
        attributionRequired: decision.attributionRequired,
        attributionText: decision.attributionText,
      });
    }
    return candidates;
  }
}

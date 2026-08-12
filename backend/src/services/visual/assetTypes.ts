import type { VisualSourceProvider } from "../../types/index.js";

/**
 * A pre-download candidate returned by an AssetProvider's search. Nothing
 * here is downloaded yet — assetDownloader.ts fetches `downloadUrl` only
 * after visualLicense.ts has approved `rawLicense`/`rawUsageTerms`.
 */
export interface AssetCandidate {
  provider: VisualSourceProvider;
  mediaType: "image" | "video";
  /** Stable id within the provider (e.g. Pixabay's numeric id, Pexels' id, or the Wikimedia page title) — combined with `provider` to form the cache key. */
  sourceId: string;
  /** Direct file URL the backend downloads from. Never sent to the frontend. */
  downloadUrl: string;
  /** The provider's own page for this asset — used for attribution/credits. */
  sourcePageUrl: string;
  author: string | null;
  width: number | null;
  height: number | null;
  /** Present for video candidates. */
  durationSeconds: number | null;
  /** Raw, unverified license/usage-terms text as reported by the provider. visualLicense.ts is the only place this is trusted or rejected. */
  rawLicense: string;
  /** Whether this candidate's license requires attribution if used (provider-declared; Pixabay/Pexels are always false). */
  attributionRequired: boolean;
  /** Pre-built attribution text, when the provider/license calls for one. */
  attributionText: string | null;
}

export interface AssetSearchOptions {
  /** Upper bound on returned height for video candidates (performance/storage budget). */
  maxVideoHeight: number;
  /** Upper bound on returned width for image candidates. */
  maxImageWidth: number;
  /** Candidate sourceIds (already prefixed by provider) to avoid re-selecting within the same job. */
  excludeSourceKeys: Set<string>;
}

/**
 * One footage/photo source. Implementations only ever return candidates —
 * they never download anything themselves (see assetDownloader.ts) and
 * never decide licensing (see visualLicense.ts) — kept separate so each
 * concern can be tested and reasoned about independently.
 */
export interface AssetProvider {
  readonly name: VisualSourceProvider;
  readonly supportsVideo: boolean;
  readonly supportsImages: boolean;
  searchVideos?(query: string, options: AssetSearchOptions): Promise<AssetCandidate[]>;
  searchImages?(query: string, options: AssetSearchOptions): Promise<AssetCandidate[]>;
}

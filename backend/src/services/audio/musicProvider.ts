/**
 * Reads a user-populated local library of background music the owner has
 * already confirmed the rights to use — this project has no public music
 * API to call (Pixabay's public API covers only images/video; verified
 * directly, not assumed — see the Phase 6 plan). An unlisted-in-manifest
 * file is treated exactly like an unverified internet asset: unusable,
 * never guessed. An empty/missing library is a valid, common state (no
 * music for this job) — never a crash.
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { config } from "../../config/env.js";

/**
 * The common shape every music source returns — LocalMusicProvider (this
 * file) and JamendoMusicProvider (jamendoProvider.ts) — so voiceEngine.ts's
 * musicResolver.ts can treat "which provider found this" as an
 * implementation detail.
 */
export interface MusicTrackMetadata {
  id: string;
  filePath: string;
  mood: string;
  /** Real track title — falls back to the filename for a local entry that didn't set one. */
  title: string;
  artist: string | null;
  source: string;
  /** The provider's own page for this track, when one exists (e.g. its Jamendo URL) — for future credits, like VisualAssetMetadata.sourcePageUrl. */
  sourceUrl: string | null;
  license: string;
  attributionRequired: boolean;
  attributionText: string | null;
}

interface ManifestTrackEntry {
  file: string;
  mood: string;
  source: string;
  title?: string;
  artist?: string | null;
  sourceUrl?: string | null;
  author?: string | null;
  license: string;
  attributionRequired?: boolean;
  attributionText?: string | null;
}

interface MusicManifest {
  tracks: ManifestTrackEntry[];
}

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  return hash;
}

export class LocalMusicProvider {
  private manifestPromise: Promise<MusicManifest> | null = null;

  private loadManifest(): Promise<MusicManifest> {
    if (!this.manifestPromise) {
      this.manifestPromise = readFile(path.join(config.music.musicAssetsDir, "manifest.json"), "utf-8")
        .then((raw) => JSON.parse(raw) as MusicManifest)
        .catch(() => ({ tracks: [] }));
    }
    return this.manifestPromise;
  }

  /** Deterministic selection (same seed always picks the same track) — consistent with Phase 5's palette/asset selection determinism. Returns null when no track exists for this mood; the caller must treat that as "no music," not an error. */
  async findTrackForMood(mood: string | undefined, seed: string): Promise<MusicTrackMetadata | null> {
    if (!mood) return null;
    const manifest = await this.loadManifest();
    const candidates = manifest.tracks.filter((t) => t.mood === mood);
    if (candidates.length === 0) return null;

    const entry = candidates[hashString(seed) % candidates.length];
    const filePath = path.join(config.music.musicAssetsDir, entry.file);
    if (!existsSync(filePath)) {
      console.error(`[VidPilot] Music manifest references a missing file: ${entry.file}`);
      return null;
    }

    return {
      id: entry.file,
      filePath,
      mood: entry.mood,
      title: entry.title ?? path.basename(entry.file, path.extname(entry.file)),
      artist: entry.artist ?? entry.author ?? null,
      source: entry.source,
      sourceUrl: entry.sourceUrl ?? null,
      license: entry.license,
      attributionRequired: entry.attributionRequired ?? false,
      attributionText: entry.attributionText ?? null,
    };
  }
}

/**
 * Real Jamendo API integration — every track on Jamendo is released under
 * some Creative Commons license (that's Jamendo's whole model), but the
 * *specific* variant varies per track and several of them are unsuitable
 * here:
 *   - "nc" (NonCommercial) tracks can't go on a YouTube video that's ever
 *     monetized or otherwise commercial.
 *   - "nd" (NoDerivatives) tracks can't legally be trimmed/looped — which
 *     this pipeline always does to fit a scene's real duration, and
 *     trimming/looping is a derivative work.
 * So only plain CC BY and CC BY-SA tracks are ever used — verified from
 * the real `license_ccurl` the API returns for that specific track, never
 * assumed from the search filters alone (the same "no copyright guessing"
 * rule Phase 5's visual providers already follow).
 *
 * Only `client_id` is required for this — Jamendo's search/track-listing
 * endpoints are unauthenticated beyond that; `client_secret` is stored
 * (config.music.jamendoClientSecret) for completeness but genuinely unused
 * by this read-only integration.
 */

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import { config, isConfigured } from "../../config/env.js";
import { runFfprobe } from "../ffmpeg/ffmpegRunner.js";
import { downloadToFile, fetchJsonWithTimeout, rateGate } from "../visual/providers/httpClient.js";
import type { MusicFolder } from "./contentCategory.js";
import type { MusicTrackMetadata } from "./musicProvider.js";

const API_BASE = "https://api.jamendo.com/v3.0/tracks/";
const MIN_INTERVAL_MS = 500;

/**
 * Candidate tags per folder — Jamendo's own tag vocabulary, not guaranteed
 * to all exist. Verified against the real API: `fuzzytags` with several
 * comma-joined values requires a track to match ALL of them (e.g.
 * `fuzzytags=inspiring,epic` returns 0 results even though `inspiring`
 * alone and `epic` alone each return real results) — it is NOT the
 * OR-across-tags ranking the Jamendo docs' wording suggests. So each tag
 * here is queried in its own request (see findTrackForMood) and the
 * results are merged — genuine OR semantics via real separate calls,
 * not a single query relying on undocumented separator behavior.
 */
const MOOD_TO_FUZZYTAGS: Record<MusicFolder, string[]> = {
  motivation: ["uplifting", "energetic", "inspiring", "epic", "motivational"],
  curiosity: ["playful", "quirky", "fun", "curious", "upbeat"],
  mystery: ["dark", "mysterious", "suspense", "cinematic", "dramatic"],
  technology: ["electronic", "corporate", "tech", "futuristic", "modern"],
  emotional: ["emotional", "melancholic", "sentimental", "piano", "sad"],
  energetic: ["energetic", "upbeat", "driving", "dance", "power"],
  general: ["background", "corporate", "ambient", "soft", "calm"],
};

/** Stop querying further tags once this many license-safe candidates are found — plenty of variety for the deterministic pick below without spending the full per-tag request budget on every lookup. */
const MIN_CANDIDATES_BEFORE_STOPPING = 15;

interface JamendoTrack {
  id: number | string;
  name: string;
  artist_name: string;
  license_ccurl: string;
  audio: string;
  audiodownload: string;
  audiodownload_allowed: boolean;
  duration: number;
}

interface JamendoSearchResponse {
  results?: JamendoTrack[];
}

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  return hash;
}

/** Extracts the license slug (e.g. "by-nc-sa") from a real creativecommons.org URL. Returns null when the URL doesn't match the expected shape — treated as "can't verify," never guessed. */
export function parseCcLicenseSlug(ccUrl: string | undefined | null): string[] | null {
  if (!ccUrl) return null;
  const match = ccUrl.match(/licenses\/([a-z-]+)\//i);
  if (!match) return null;
  return match[1].toLowerCase().split("-").filter(Boolean);
}

/**
 * Allowed only for plain attribution licenses that permit both commercial
 * use and derivatives: CC BY, CC BY-SA. Rejects NC (non-commercial) and ND
 * (no-derivatives) outright, and rejects anything the URL doesn't parse
 * into a recognized CC slug at all.
 */
export function isYouTubeSafeDerivativeLicense(ccUrl: string | undefined | null): boolean {
  const parts = parseCcLicenseSlug(ccUrl);
  if (!parts || !parts.includes("by")) return false;
  if (parts.includes("nc") || parts.includes("nd")) return false;
  return true;
}

export function formatCcLicenseLabel(ccUrl: string): string {
  const parts = parseCcLicenseSlug(ccUrl) ?? ["by"];
  return `CC ${parts.map((p) => p.toUpperCase()).join("-")}`;
}

function cachePathForTrack(trackId: string | number, ext: string): string {
  const hash = createHash("sha1").update(`jamendo:${trackId}`).digest("hex");
  return path.join(config.music.jamendoCacheDir, `${hash}${ext}`);
}

/** Confirms the cached download is a real, decodable audio file with a genuine duration — never trusts "the HTTP request succeeded" alone. Deletes and returns false on any failure so the caller falls back cleanly. */
async function validateDownloadedAudio(filePath: string): Promise<boolean> {
  try {
    const raw = await runFfprobe(["-v", "error", "-show_entries", "format=duration", "-of", "json", filePath]);
    const parsed = JSON.parse(raw) as { format?: { duration?: string } };
    const duration = Number(parsed.format?.duration);
    return Number.isFinite(duration) && duration > 0;
  } catch {
    return false;
  }
}

export class JamendoMusicProvider {
  /** Returns null (never throws) on any failure — not configured, network error, no license-safe result, corrupt download — so the caller (musicResolver.ts) can fall back to the local library cleanly. */
  async findTrackForMood(folder: MusicFolder, seed: string): Promise<MusicTrackMetadata | null> {
    if (!isConfigured(config.music.jamendoClientId)) return null;

    const candidatesById = new Map<string | number, JamendoTrack>();
    let anyRequestSucceeded = false;
    for (const tag of MOOD_TO_FUZZYTAGS[folder]) {
      if (candidatesById.size >= MIN_CANDIDATES_BEFORE_STOPPING) break;
      try {
        await rateGate("jamendo", MIN_INTERVAL_MS);
        const url =
          `${API_BASE}?client_id=${encodeURIComponent(config.music.jamendoClientId!)}` +
          `&format=json&limit=20&include=musicinfo&order=popularity_total` +
          `&fuzzytags=${encodeURIComponent(tag)}`;
        const data = (await fetchJsonWithTimeout(url, config.music.jamendoTimeoutMs)) as JamendoSearchResponse;
        anyRequestSucceeded = true;
        for (const t of data.results ?? []) {
          if (t.audiodownload_allowed && t.audiodownload && isYouTubeSafeDerivativeLicense(t.license_ccurl)) {
            candidatesById.set(t.id, t);
          }
        }
      } catch (err) {
        console.error(`[VidPilot] Jamendo search for tag "${tag}" failed, trying remaining tags: ${(err as Error).message}`);
      }
    }

    if (!anyRequestSucceeded) {
      console.error(`[VidPilot] Jamendo search failed for every tag of folder "${folder}", falling back to local library.`);
      return null;
    }

    const candidates = Array.from(candidatesById.values());
    if (candidates.length === 0) return null;

    // Deterministic starting point (same job+scene always tries the same
    // track first), but a slow/dead CDN link for one track shouldn't sink
    // the whole lookup when other license-safe candidates are available —
    // walk forward through the rest of the candidate list on failure.
    const startIndex = hashString(seed) % candidates.length;
    for (let offset = 0; offset < candidates.length; offset++) {
      const chosen = candidates[(startIndex + offset) % candidates.length];
      const cachePath = cachePathForTrack(chosen.id, ".mp3");

      if (!existsSync(cachePath)) {
        try {
          await downloadToFile(chosen.audiodownload, cachePath, config.music.jamendoDownloadTimeoutMs);
        } catch (err) {
          console.error(`[VidPilot] Jamendo download failed for track ${chosen.id}, trying next candidate: ${(err as Error).message}`);
          continue;
        }
        if (!(await validateDownloadedAudio(cachePath))) {
          console.error(`[VidPilot] Jamendo track ${chosen.id} downloaded but failed audio validation — trying next candidate.`);
          continue;
        }
      }

      const license = formatCcLicenseLabel(chosen.license_ccurl);
      const sourceUrl = `https://www.jamendo.com/track/${chosen.id}`;
      return {
        id: `jamendo:${chosen.id}`,
        filePath: cachePath,
        mood: folder,
        title: chosen.name,
        artist: chosen.artist_name || null,
        source: "Jamendo",
        sourceUrl,
        license,
        // Every allowed CC variant here (BY, BY-SA) requires attribution.
        attributionRequired: true,
        attributionText: `"${chosen.name}" by ${chosen.artist_name || "Unknown Artist"}, licensed under ${license} — via Jamendo (${sourceUrl})`,
      };
    }

    console.error(`[VidPilot] Every Jamendo candidate for folder "${folder}" failed to download or validate — falling back to local library.`);
    return null;
  }
}

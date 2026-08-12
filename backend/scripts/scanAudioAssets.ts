/**
 * Discovery helper for the manually-populated music/SFX libraries
 * (assets/music/, assets/sfx/ — see each folder's README). Walks every
 * audio file actually present on disk and reports which ones are NOT yet
 * in manifest.json, so populating the library gives you a clear checklist
 * instead of the system silently guessing metadata for an undocumented
 * file. Run with: npm run scan-audio
 *
 * This never grants a file "real" status by itself — that still requires
 * a manifest entry with real license info (musicProvider.ts/sfxProvider.ts
 * refuse to use a file that isn't listed, even after this script finds it).
 */

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { config } from "../src/config/env.js";

const AUDIO_EXTENSIONS = new Set([".mp3", ".wav", ".ogg", ".m4a", ".flac"]);

async function walkAudioFiles(rootDir: string): Promise<string[]> {
  const results: string[] = [];
  async function walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return; // folder doesn't exist yet — nothing to report
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (AUDIO_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        results.push(path.relative(rootDir, full).split(path.sep).join("/"));
      }
    }
  }
  await walk(rootDir);
  return results;
}

async function readManifestFiles(manifestPath: string, key: "tracks" | "sfx"): Promise<Set<string>> {
  try {
    const raw = await readFile(manifestPath, "utf-8");
    const parsed = JSON.parse(raw) as Record<string, { file: string }[]>;
    return new Set((parsed[key] ?? []).map((entry) => entry.file));
  } catch {
    return new Set();
  }
}

async function report(label: string, assetsDir: string, manifestKey: "tracks" | "sfx"): Promise<void> {
  const filesOnDisk = await walkAudioFiles(assetsDir);
  const manifestFiles = await readManifestFiles(path.join(assetsDir, "manifest.json"), manifestKey);

  const missing = filesOnDisk.filter((f) => !manifestFiles.has(f));
  const staleManifestEntries = [...manifestFiles].filter((f) => !filesOnDisk.includes(f));

  console.log(`\n=== ${label} (${assetsDir}) ===`);
  console.log(`Real audio files found on disk: ${filesOnDisk.length}`);
  console.log(`Files already in manifest.json: ${manifestFiles.size}`);

  if (missing.length > 0) {
    console.log(`\n${missing.length} file(s) need a manifest entry before they'll ever be used:`);
    for (const file of missing) console.log(`  - ${file}`);
  } else if (filesOnDisk.length > 0) {
    console.log("Every file on disk already has a manifest entry.");
  } else {
    console.log("No audio files found yet — this is a normal, valid state (no music/SFX for now).");
  }

  if (staleManifestEntries.length > 0) {
    console.log(`\n${staleManifestEntries.length} manifest entry(ies) reference a file that no longer exists on disk:`);
    for (const file of staleManifestEntries) console.log(`  - ${file}`);
  }
}

async function main(): Promise<void> {
  await report("Music", config.music.musicAssetsDir, "tracks");
  await report("SFX", config.music.sfxAssetsDir, "sfx");
}

main().catch((err) => {
  console.error("[VidPilot] scan-audio failed:", err);
  process.exitCode = 1;
});

import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { config } from "../../config/env.js";
import { LocalMusicProvider } from "./musicProvider.js";

describe("LocalMusicProvider", () => {
  let dir: string;
  let originalDir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "vidpilot-music-test-"));
    originalDir = config.music.musicAssetsDir;
    config.music.musicAssetsDir = dir;
  });

  afterEach(() => {
    config.music.musicAssetsDir = originalDir;
    rmSync(dir, { recursive: true, force: true });
  });

  function writeManifest(tracks: unknown[]): void {
    writeFileSync(path.join(dir, "manifest.json"), JSON.stringify({ tracks }));
  }

  function touchFile(relativePath: string): void {
    const full = path.join(dir, relativePath);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, "not real audio, just a placeholder for existence checks");
  }

  it("returns null when no music library exists at all (no manifest.json)", async () => {
    const provider = new LocalMusicProvider();
    const result = await provider.findTrackForMood("energetic", "job-1:scene-1");
    expect(result).toBeNull();
  });

  it("returns null when the mood has no matching tracks", async () => {
    touchFile("calm/track1.mp3");
    writeManifest([{ file: "calm/track1.mp3", mood: "calm", source: "test", license: "CC0" }]);
    const provider = new LocalMusicProvider();
    const result = await provider.findTrackForMood("energetic", "job-1:scene-1");
    expect(result).toBeNull();
  });

  it("returns a real track's metadata for a matching mood", async () => {
    touchFile("energetic/track1.mp3");
    writeManifest([
      { file: "energetic/track1.mp3", mood: "energetic", source: "Local library", author: "Jane Doe", license: "CC0", attributionRequired: false },
    ]);
    const provider = new LocalMusicProvider();
    const result = await provider.findTrackForMood("energetic", "job-1:scene-1");
    expect(result).not.toBeNull();
    expect(result?.mood).toBe("energetic");
    expect(result?.license).toBe("CC0");
    expect(result?.filePath).toBe(path.join(dir, "energetic/track1.mp3"));
  });

  it("selects deterministically — the same seed always picks the same track among several candidates", async () => {
    touchFile("mysterious/a.mp3");
    touchFile("mysterious/b.mp3");
    touchFile("mysterious/c.mp3");
    writeManifest([
      { file: "mysterious/a.mp3", mood: "mysterious", source: "s", license: "CC0" },
      { file: "mysterious/b.mp3", mood: "mysterious", source: "s", license: "CC0" },
      { file: "mysterious/c.mp3", mood: "mysterious", source: "s", license: "CC0" },
    ]);
    const provider = new LocalMusicProvider();
    const first = await provider.findTrackForMood("mysterious", "job-42:scene-3");
    const second = await provider.findTrackForMood("mysterious", "job-42:scene-3");
    expect(first?.id).toBe(second?.id);
  });

  it("treats a manifest entry whose file is missing on disk as unusable, not a crash", async () => {
    writeManifest([{ file: "calm/does-not-exist.mp3", mood: "calm", source: "s", license: "CC0" }]);
    const provider = new LocalMusicProvider();
    const result = await provider.findTrackForMood("calm", "job-1:scene-1");
    expect(result).toBeNull();
  });

  it("returns null when mood is undefined", async () => {
    const provider = new LocalMusicProvider();
    const result = await provider.findTrackForMood(undefined, "job-1:scene-1");
    expect(result).toBeNull();
  });
});

import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { config } from "../../config/env.js";
import { LocalSfxProvider } from "./sfxProvider.js";

describe("LocalSfxProvider", () => {
  let dir: string;
  let originalDir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "vidpilot-sfx-test-"));
    originalDir = config.music.sfxAssetsDir;
    config.music.sfxAssetsDir = dir;
  });

  afterEach(() => {
    config.music.sfxAssetsDir = originalDir;
    rmSync(dir, { recursive: true, force: true });
  });

  function writeManifest(sfx: unknown[]): void {
    writeFileSync(path.join(dir, "manifest.json"), JSON.stringify({ sfx }));
  }

  function touchFile(relativePath: string): void {
    const full = path.join(dir, relativePath);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, "placeholder");
  }

  it("returns null with no manifest present", async () => {
    const provider = new LocalSfxProvider();
    expect(await provider.findSfxForType("whoosh", "seed")).toBeNull();
  });

  it("returns a real sfx's metadata for a matching type", async () => {
    touchFile("whoosh/whoosh1.wav");
    writeManifest([{ file: "whoosh/whoosh1.wav", type: "whoosh", source: "Local", license: "CC0" }]);
    const provider = new LocalSfxProvider();
    const result = await provider.findSfxForType("whoosh", "seed");
    expect(result?.type).toBe("whoosh");
    expect(result?.filePath).toBe(path.join(dir, "whoosh/whoosh1.wav"));
  });

  it("treats a missing referenced file as unusable, not a crash", async () => {
    writeManifest([{ file: "pop/missing.wav", type: "pop", source: "s", license: "CC0" }]);
    const provider = new LocalSfxProvider();
    expect(await provider.findSfxForType("pop", "seed")).toBeNull();
  });
});

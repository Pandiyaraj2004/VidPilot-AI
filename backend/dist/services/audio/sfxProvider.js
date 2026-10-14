/** Same manifest-driven, license-honest convention as musicProvider.ts, for short one-shot sound effects (whoosh, pop, click, reveal, etc). */
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { config } from "../../config/env.js";
function hashString(input) {
    let hash = 0;
    for (let i = 0; i < input.length; i++)
        hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
    return hash;
}
export class LocalSfxProvider {
    manifestPromise = null;
    loadManifest() {
        if (!this.manifestPromise) {
            this.manifestPromise = readFile(path.join(config.music.sfxAssetsDir, "manifest.json"), "utf-8")
                .then((raw) => JSON.parse(raw))
                .catch(() => ({ sfx: [] }));
        }
        return this.manifestPromise;
    }
    async findSfxForType(type, seed) {
        if (!type)
            return null;
        const manifest = await this.loadManifest();
        const candidates = manifest.sfx.filter((s) => s.type === type);
        if (candidates.length === 0)
            return null;
        const entry = candidates[hashString(seed) % candidates.length];
        const filePath = path.join(config.music.sfxAssetsDir, entry.file);
        if (!existsSync(filePath)) {
            console.error(`[VidPilot] SFX manifest references a missing file: ${entry.file}`);
            return null;
        }
        return {
            id: entry.file,
            filePath,
            type: entry.type,
            source: entry.source,
            author: entry.author ?? null,
            license: entry.license,
            attributionRequired: entry.attributionRequired ?? false,
            attributionText: entry.attributionText ?? null,
        };
    }
}

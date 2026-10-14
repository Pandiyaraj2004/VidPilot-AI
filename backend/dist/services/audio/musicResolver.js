/**
 * Music source of record: Jamendo (real API) first, the manually-populated
 * LocalMusicProvider as a genuine fallback — never a fake "no music"
 * result when either source is simply unconfigured or empty. Neither
 * provider throws; this just tries one then the other.
 */
import { JamendoMusicProvider } from "./jamendoProvider.js";
import { LocalMusicProvider } from "./musicProvider.js";
export class MusicResolver {
    jamendo;
    local;
    constructor(jamendo = new JamendoMusicProvider(), local = new LocalMusicProvider()) {
        this.jamendo = jamendo;
        this.local = local;
    }
    async findTrackForMood(folder, seed) {
        const jamendoResult = await this.jamendo.findTrackForMood(folder, seed).catch((err) => {
            console.error(`[VidPilot] Jamendo lookup errored unexpectedly, falling back to local library: ${err.message}`);
            return null;
        });
        if (jamendoResult)
            return jamendoResult;
        return this.local.findTrackForMood(folder, seed);
    }
}

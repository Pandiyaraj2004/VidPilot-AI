/**
 * Music source of record: Jamendo (real API) first, the manually-populated
 * LocalMusicProvider as a genuine fallback — never a fake "no music"
 * result when either source is simply unconfigured or empty. Neither
 * provider throws; this just tries one then the other.
 */

import { JamendoMusicProvider } from "./jamendoProvider.js";
import { LocalMusicProvider, type MusicTrackMetadata } from "./musicProvider.js";
import type { MusicFolder } from "./contentCategory.js";

/** What MusicResolver needs from any music source — both JamendoMusicProvider and LocalMusicProvider satisfy this; tests inject fakes against this interface instead of the concrete classes. */
export interface MusicSource {
  findTrackForMood(folder: MusicFolder, seed: string): Promise<MusicTrackMetadata | null>;
}

export class MusicResolver {
  constructor(
    private readonly jamendo: MusicSource = new JamendoMusicProvider(),
    private readonly local: MusicSource = new LocalMusicProvider()
  ) {}

  async findTrackForMood(folder: MusicFolder, seed: string): Promise<MusicTrackMetadata | null> {
    const jamendoResult = await this.jamendo.findTrackForMood(folder, seed).catch((err) => {
      console.error(`[VidPilot] Jamendo lookup errored unexpectedly, falling back to local library: ${(err as Error).message}`);
      return null;
    });
    if (jamendoResult) return jamendoResult;

    return this.local.findTrackForMood(folder, seed);
  }
}

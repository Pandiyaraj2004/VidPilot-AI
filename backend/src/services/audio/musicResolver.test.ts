import { describe, it, expect } from "vitest";
import { MusicResolver, type MusicSource } from "./musicResolver.js";
import type { MusicTrackMetadata } from "./musicProvider.js";

function fakeTrack(overrides: Partial<MusicTrackMetadata> = {}): MusicTrackMetadata {
  return {
    id: "fake:1",
    filePath: "/fake/path.mp3",
    mood: "energetic",
    title: "Fake Track",
    artist: "Fake Artist",
    source: "Fake",
    sourceUrl: null,
    license: "CC BY",
    attributionRequired: true,
    attributionText: "attribution",
    ...overrides,
  };
}

describe("MusicResolver — Jamendo primary, LocalMusicProvider fallback", () => {
  it("returns the Jamendo result when Jamendo finds a track", async () => {
    const jamendo: MusicSource = { findTrackForMood: async () => fakeTrack({ source: "Jamendo" }) };
    const local: MusicSource = { findTrackForMood: async () => fakeTrack({ source: "Local" }) };
    const resolver = new MusicResolver(jamendo, local);

    const result = await resolver.findTrackForMood("energetic", "seed");
    expect(result?.source).toBe("Jamendo");
  });

  it("falls back to the local library when Jamendo returns null (not configured, no match, etc.)", async () => {
    const jamendo: MusicSource = { findTrackForMood: async () => null };
    const local: MusicSource = { findTrackForMood: async () => fakeTrack({ source: "Local" }) };
    const resolver = new MusicResolver(jamendo, local);

    const result = await resolver.findTrackForMood("energetic", "seed");
    expect(result?.source).toBe("Local");
  });

  it("falls back to the local library when Jamendo throws unexpectedly, rather than failing the scene", async () => {
    const jamendo: MusicSource = {
      findTrackForMood: async () => {
        throw new Error("unexpected network failure");
      },
    };
    const local: MusicSource = { findTrackForMood: async () => fakeTrack({ source: "Local" }) };
    const resolver = new MusicResolver(jamendo, local);

    const result = await resolver.findTrackForMood("energetic", "seed");
    expect(result?.source).toBe("Local");
  });

  it("returns null when neither source has anything — a valid 'no music' state, not an error", async () => {
    const jamendo: MusicSource = { findTrackForMood: async () => null };
    const local: MusicSource = { findTrackForMood: async () => null };
    const resolver = new MusicResolver(jamendo, local);

    const result = await resolver.findTrackForMood("general", "seed");
    expect(result).toBeNull();
  });
});

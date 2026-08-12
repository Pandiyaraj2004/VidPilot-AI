import { describe, expect, it } from "vitest";
import { parseWavMetadata } from "./audioMetadata.js";

function buildWavBuffer(options: {
  sampleRate?: number;
  channels?: number;
  bitsPerSample?: number;
  sampleCount: number;
  amplitude?: number;
}): Buffer {
  const { sampleRate = 22050, channels = 1, bitsPerSample = 16, sampleCount, amplitude = 1000 } = options;
  const bytesPerSample = bitsPerSample / 8;
  const dataSize = sampleCount * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * bytesPerSample, 28);
  buffer.writeUInt16LE(channels * bytesPerSample, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < sampleCount; i++) {
    buffer.writeInt16LE(amplitude, 44 + i * 2);
  }

  return buffer;
}

describe("parseWavMetadata", () => {
  it("extracts real duration/sampleRate/channels from a valid WAV buffer", () => {
    const buffer = buildWavBuffer({ sampleCount: 22050 }); // 1 second at 22050Hz mono
    const meta = parseWavMetadata(buffer);
    expect(meta.sampleRate).toBe(22050);
    expect(meta.channels).toBe(1);
    expect(meta.bitsPerSample).toBe(16);
    expect(meta.durationSeconds).toBeCloseTo(1, 2);
  });

  it("computes duration correctly for stereo audio", () => {
    const buffer = buildWavBuffer({ sampleCount: 44100, channels: 2, sampleRate: 44100 });
    const meta = parseWavMetadata(buffer);
    // sampleCount here is total interleaved samples across both channels
    expect(meta.durationSeconds).toBeCloseTo(0.5, 2);
  });

  it("throws for a file too small to be a WAV", () => {
    expect(() => parseWavMetadata(Buffer.alloc(10))).toThrow(/too small/);
  });

  it("throws for a file missing the RIFF/WAVE header", () => {
    const buffer = Buffer.alloc(44);
    buffer.write("JUNKDATA", 0, "ascii");
    expect(() => parseWavMetadata(buffer)).toThrow(/not a valid WAV/);
  });

  it("throws for a WAV with no data chunk", () => {
    const buffer = Buffer.alloc(44);
    buffer.write("RIFF", 0, "ascii");
    buffer.writeUInt32LE(36, 4);
    buffer.write("WAVE", 8, "ascii");
    buffer.write("fmt ", 12, "ascii");
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(1, 22);
    buffer.writeUInt32LE(22050, 24);
    buffer.writeUInt32LE(44100, 28);
    buffer.writeUInt16LE(2, 32);
    buffer.writeUInt16LE(16, 34);
    expect(() => parseWavMetadata(buffer)).toThrow(/no audio data/);
  });
});

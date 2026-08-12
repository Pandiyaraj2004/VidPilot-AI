import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { validateAudioFile } from "./audioValidator.js";

function buildWavBuffer(options: { sampleCount: number; amplitude: number }): Buffer {
  const { sampleCount, amplitude } = options;
  const sampleRate = 22050;
  const dataSize = sampleCount * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < sampleCount; i++) {
    // Alternate sign so it doesn't average to a DC offset that could mask silence.
    const sign = i % 2 === 0 ? 1 : -1;
    buffer.writeInt16LE(sign * amplitude, 44 + i * 2);
  }

  return buffer;
}

/** Concatenates several fixed-amplitude segments into one WAV — used to build audio with a specific clipped run or a specific internal silent gap at a known position. */
function buildWavBufferWithSegments(segments: { sampleCount: number; amplitude: number }[]): Buffer {
  const sampleRate = 22050;
  const totalSamples = segments.reduce((sum, s) => sum + s.sampleCount, 0);
  const dataSize = totalSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataSize, 40);

  let offset = 44;
  for (const segment of segments) {
    for (let i = 0; i < segment.sampleCount; i++) {
      const sign = i % 2 === 0 ? 1 : -1;
      buffer.writeInt16LE(sign * segment.amplitude, offset);
      offset += 2;
    }
  }
  return buffer;
}

describe("validateAudioFile — Phase 6 clipping/internal-silence checks", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "vidpilot-audio-test-p6-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("fails when a sustained run of samples is pinned at full scale", async () => {
    const file = path.join(dir, "clipped.wav");
    writeFileSync(file, buildWavBufferWithSegments([
      { sampleCount: 5000, amplitude: 8000 },
      { sampleCount: 100, amplitude: 32767 },
      { sampleCount: 5000, amplitude: 8000 },
    ]));
    const result = await validateAudioFile(file);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.toLowerCase().includes("clipping"))).toBe(true);
  });

  it("passes normal loud audio with no sustained full-scale run (a couple of naturally loud peaks is not clipping)", async () => {
    const file = path.join(dir, "loud-not-clipped.wav");
    writeFileSync(file, buildWavBufferWithSegments([{ sampleCount: 22050, amplitude: 20000 }]));
    const result = await validateAudioFile(file);
    expect(result.valid).toBe(true);
  });

  it("fails when an internal silent gap exceeds the default allowance", async () => {
    const file = path.join(dir, "long-internal-silence.wav");
    writeFileSync(file, buildWavBufferWithSegments([
      { sampleCount: 22050, amplitude: 8000 }, // 1s loud
      { sampleCount: Math.round(22050 * 1.5), amplitude: 5 }, // 1.5s near-silent
      { sampleCount: 22050, amplitude: 8000 }, // 1s loud
    ]));
    const result = await validateAudioFile(file);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("silent gap"))).toBe(true);
  });

  it("accepts the same internal gap when maxInternalSilenceSeconds allows for a deliberate pause", async () => {
    const file = path.join(dir, "deliberate-pause.wav");
    writeFileSync(file, buildWavBufferWithSegments([
      { sampleCount: 22050, amplitude: 8000 },
      { sampleCount: Math.round(22050 * 1.5), amplitude: 5 },
      { sampleCount: 22050, amplitude: 8000 },
    ]));
    const result = await validateAudioFile(file, { maxInternalSilenceSeconds: 2.0 });
    expect(result.valid).toBe(true);
  });
});

describe("validateAudioFile", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "vidpilot-audio-test-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("passes for a real, loud-enough WAV file", async () => {
    const file = path.join(dir, "valid.wav");
    writeFileSync(file, buildWavBuffer({ sampleCount: 22050, amplitude: 8000 }));

    const result = await validateAudioFile(file);
    expect(result.valid).toBe(true);
    expect(result.metadata?.durationSeconds).toBeCloseTo(1, 2);
  });

  it("fails for a file that does not exist", async () => {
    const result = await validateAudioFile(path.join(dir, "missing.wav"));
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/does not exist/);
  });

  it("fails for an empty file", async () => {
    const file = path.join(dir, "empty.wav");
    writeFileSync(file, Buffer.alloc(0));
    const result = await validateAudioFile(file);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/empty/);
  });

  it("fails for a corrupted (non-WAV) file", async () => {
    const file = path.join(dir, "corrupt.wav");
    writeFileSync(file, Buffer.from("this is not a wav file at all, just text padding to be long enough"));
    const result = await validateAudioFile(file);
    expect(result.valid).toBe(false);
  });

  it("fails for a silent (near-zero amplitude) WAV file", async () => {
    const file = path.join(dir, "silent.wav");
    writeFileSync(file, buildWavBuffer({ sampleCount: 22050, amplitude: 5 }));
    const result = await validateAudioFile(file);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("silent"))).toBe(true);
  });
});

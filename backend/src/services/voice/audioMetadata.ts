import { readFile } from "node:fs/promises";

export interface AudioMetadata {
  format: "wav";
  durationSeconds: number;
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  fileSizeBytes: number;
}

/**
 * Reads real values out of the WAV header/chunks — never estimates duration
 * from word count or file size. Deliberately hand-rolled rather than
 * shelling out to ffprobe: Piper's output is always canonical PCM WAV, and
 * parsing the handful of bytes we need keeps this dependency-free.
 */
export function parseWavMetadata(buffer: Buffer): AudioMetadata {
  if (buffer.length < 44) {
    throw new Error("File is too small to be a valid WAV file.");
  }
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("File is not a valid WAV file (missing RIFF/WAVE header).");
  }

  let offset = 12;
  let sampleRate: number | null = null;
  let channels: number | null = null;
  let bitsPerSample: number | null = null;
  let dataSize: number | null = null;

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;

    if (chunkId === "fmt " && chunkStart + 16 <= buffer.length) {
      channels = buffer.readUInt16LE(chunkStart + 2);
      sampleRate = buffer.readUInt32LE(chunkStart + 4);
      bitsPerSample = buffer.readUInt16LE(chunkStart + 14);
    } else if (chunkId === "data") {
      dataSize = Math.min(chunkSize, buffer.length - chunkStart);
    }

    // RIFF chunks are word-aligned: a chunk with an odd size has one pad byte after it.
    offset = chunkStart + chunkSize + (chunkSize % 2);
    if (sampleRate !== null && dataSize !== null) break;
  }

  if (sampleRate === null || channels === null || bitsPerSample === null) {
    throw new Error("WAV file is missing a valid fmt chunk.");
  }
  if (dataSize === null || dataSize === 0) {
    throw new Error("WAV file has no audio data.");
  }

  const bytesPerSample = bitsPerSample / 8;
  const durationSeconds = dataSize / (sampleRate * channels * bytesPerSample);

  return {
    format: "wav",
    durationSeconds,
    sampleRate,
    channels,
    bitsPerSample,
    fileSizeBytes: buffer.length,
  };
}

export async function readAudioMetadata(filePath: string): Promise<AudioMetadata> {
  const buffer = await readFile(filePath);
  return parseWavMetadata(buffer);
}

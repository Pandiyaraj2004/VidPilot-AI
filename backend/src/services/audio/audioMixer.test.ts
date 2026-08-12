import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runFfmpeg } from "../ffmpeg/ffmpegRunner.js";
import { readAudioMetadata } from "../voice/audioMetadata.js";
import { mixSceneAudio } from "./audioMixer.js";

async function makeTone(outputPath: string, seconds: number, frequency = 440, sampleRate = 22050): Promise<void> {
  await runFfmpeg([
    "-y", "-f", "lavfi", "-i", `sine=frequency=${frequency}:sample_rate=${sampleRate}`,
    "-t", String(seconds), "-ar", String(sampleRate), "-ac", "1", "-sample_fmt", "s16",
    outputPath,
  ]);
}

/** RMS of the 16-bit PCM samples in [startSeconds, startSeconds + windowSeconds) — real amplitude read from the file, not an ffmpeg log line, so it works the same whether the caller wants to prove silence or prove real signal. */
function rmsAt(filePath: string, sampleRate: number, startSeconds: number, windowSeconds: number): number {
  const buffer = readFileSync(filePath);
  let offset = 12;
  let dataOffset = -1;
  let dataSize = 0;
  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    if (chunkId === "data") {
      dataOffset = chunkStart;
      dataSize = Math.min(chunkSize, buffer.length - chunkStart);
      break;
    }
    offset = chunkStart + chunkSize + (chunkSize % 2);
  }
  if (dataOffset < 0) throw new Error("No data chunk found.");

  const startSample = Math.floor(startSeconds * sampleRate);
  const endSample = Math.min(startSample + Math.floor(windowSeconds * sampleRate), Math.floor(dataSize / 2));
  let sumSquares = 0;
  let counted = 0;
  for (let i = startSample; i < endSample; i++) {
    const sample = buffer.readInt16LE(dataOffset + i * 2);
    sumSquares += sample * sample;
    counted += 1;
  }
  return counted > 0 ? Math.sqrt(sumSquares / counted) : 0;
}

describe("mixSceneAudio (real ffmpeg)", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "vidpilot-mixer-test-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("copies narration through unchanged when there is no music and no sfx", async () => {
    const narration = path.join(dir, "narration.wav");
    const output = path.join(dir, "out.wav");
    await makeTone(narration, 2.0);

    const result = await mixSceneAudio({ narrationPath: narration, outputPath: output });

    expect(result).toEqual({ usedMusic: false, usedDynamicDucking: false, usedSfxCount: 0 });
    const meta = await readAudioMetadata(output);
    expect(meta.durationSeconds).toBeCloseTo(2.0, 1);
  });

  it("mixes real background music under narration, trimmed to the narration's real duration", async () => {
    const narration = path.join(dir, "narration.wav");
    const music = path.join(dir, "music.wav");
    const output = path.join(dir, "out.wav");
    await makeTone(narration, 3.0, 440);
    await makeTone(music, 5.0, 880); // deliberately longer and a different pitch

    const result = await mixSceneAudio({ narrationPath: narration, musicPath: music, outputPath: output });

    expect(result.usedMusic).toBe(true);
    expect(typeof result.usedDynamicDucking).toBe("boolean");
    const meta = await readAudioMetadata(output);
    expect(meta.durationSeconds).toBeCloseTo(3.0, 0);
  });

  it("loops a music track shorter than the narration to cover its full duration", async () => {
    const narration = path.join(dir, "narration.wav");
    const music = path.join(dir, "music.wav");
    const output = path.join(dir, "out.wav");
    await makeTone(narration, 4.0, 440);
    await makeTone(music, 1.0, 660); // shorter than narration — must be looped, not truncated

    await mixSceneAudio({ narrationPath: narration, musicPath: music, outputPath: output });

    const meta = await readAudioMetadata(output);
    expect(meta.durationSeconds).toBeCloseTo(4.0, 0);
  });

  it("keeps music audible during a real silent gap in the narration (regression: sidechaincompress input order)", async () => {
    // sidechaincompress's two inputs are [main][sidechain] — only main's audio
    // reaches the output; the sidechain input is a control signal only. With
    // the inputs swapped, the "ducked music" branch was actually a compressed
    // copy of the narration, so music never appeared in the output at all —
    // silent wherever narration was silent instead of recovering to full
    // volume there. A narration with a real internal gap (unlike the other
    // cases above, which are continuous tone) is the only way to tell these
    // two failure modes apart.
    const narration = path.join(dir, "narration.wav");
    const music = path.join(dir, "music.wav");
    const output = path.join(dir, "out.wav");
    const sampleRate = 22050;

    await runFfmpeg([
      "-y",
      "-f", "lavfi", "-i", `sine=frequency=440:sample_rate=${sampleRate}:duration=1`,
      "-f", "lavfi", "-i", `anullsrc=sample_rate=${sampleRate}:channel_layout=mono:duration=2`,
      "-f", "lavfi", "-i", `sine=frequency=440:sample_rate=${sampleRate}:duration=1`,
      "-filter_complex", "[0:a][1:a][2:a]concat=n=3:v=0:a=1[out]",
      "-map", "[out]", "-ar", String(sampleRate), "-ac", "1", "-sample_fmt", "s16",
      narration,
    ]);
    await makeTone(music, 5.0, 880, sampleRate);

    await mixSceneAudio({ narrationPath: narration, musicPath: music, outputPath: output });

    // Well inside the narration's 1s-3s silent gap, clear of the ducking
    // release ramp at either edge — real background music must still be
    // audible here, not the digital silence a compressed copy of the
    // (silent) narration would produce.
    const gapRms = rmsAt(output, sampleRate, 2.0, 0.3);
    expect(gapRms).toBeGreaterThan(500);
  });

  it("overlays a real SFX clip without extending past the narration's duration", async () => {
    const narration = path.join(dir, "narration.wav");
    const sfx = path.join(dir, "sfx.wav");
    const output = path.join(dir, "out.wav");
    await makeTone(narration, 3.0, 440);
    await makeTone(sfx, 0.3, 1200);

    const result = await mixSceneAudio({
      narrationPath: narration,
      sfx: [{ path: sfx, offsetSeconds: 1.0 }],
      outputPath: output,
    });

    expect(result.usedSfxCount).toBe(1);
    const meta = await readAudioMetadata(output);
    expect(meta.durationSeconds).toBeCloseTo(3.0, 0);
  });
});

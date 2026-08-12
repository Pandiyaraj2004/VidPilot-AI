import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { VideoScene } from "../../types/index.js";
import { getJobAudioDir } from "./audioStorage.js";
import { planSfxTriggers, runVoiceGeneration, type VoiceEngineOptions } from "./voiceEngine.js";
import { VoiceProviderError, type VoiceInput, type VoiceProvider, type VoiceResult } from "./voiceProvider.js";

/**
 * The real voice engine now assembles each scene's final audio with real
 * ffmpeg processing (trim/concat/normalize — see audioProcessor.ts) on
 * whatever the provider actually wrote to `outputPath`. A fake provider
 * that only returns a result object without writing a real file would
 * make every scene fail that real downstream processing — so this fake
 * writes a short, genuinely non-silent PCM WAV, exactly like Piper/Edge
 * TTS would, rather than mocking the file system.
 */
function writeFakeWav(outputPath: string, durationSeconds = 0.6, sampleRate = 22050): void {
  const numSamples = Math.floor(durationSeconds * sampleRate);
  const dataSize = numSamples * 2;
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
  for (let i = 0; i < numSamples; i++) {
    const sample = Math.round(Math.sin((i / sampleRate) * 2 * Math.PI * 220) * 8000);
    buffer.writeInt16LE(sample, 44 + i * 2);
  }
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, buffer);
}

function makeScene(overrides: Partial<VideoScene> = {}): VideoScene {
  return {
    id: `scene-${overrides.order ?? 0}`,
    order: 0,
    narration: "This is a narration line long enough to be realistic.",
    visualDescription: "A relevant visual.",
    onScreenText: "Caption",
    estimatedDuration: 10,
    ...overrides,
  };
}

class FakeVoiceProvider implements VoiceProvider {
  readonly name = "piper" as const;
  calls: VoiceInput[] = [];

  constructor(private readonly script: (() => VoiceResult)[]) {}

  async generateSpeech(input: VoiceInput): Promise<VoiceResult> {
    this.calls.push(input);
    const step = this.script[Math.min(this.calls.length - 1, this.script.length - 1)];
    const result = step();
    writeFakeWav(input.outputPath);
    return result;
  }
}

function succeed(): VoiceResult {
  return { provider: "piper", audioPath: "/fake/path.wav", durationSeconds: 5, format: "wav", sampleRate: 22050 };
}

function fail(kind: "process_failed" | "voice_unavailable" | "invalid_input" = "process_failed"): never {
  throw new VoiceProviderError(kind, `Simulated ${kind} failure.`);
}

const testJobIds: string[] = [];
function newTestJobId(): string {
  const id = `voice-engine-test-${randomUUID()}`;
  testJobIds.push(id);
  return id;
}

afterEach(() => {
  for (const id of testJobIds.splice(0)) {
    rmSync(getJobAudioDir(id), { recursive: true, force: true });
  }
});

const BASE: Omit<VoiceEngineOptions, "jobId" | "scenes"> = {
  language: "en",
  voiceId: "en_US-amy-medium",
  speed: 1.0,
  contentCategory: "general_knowledge",
};

describe("runVoiceGeneration", () => {
  it("generates audio for every pending scene", async () => {
    const scenes = [makeScene({ order: 0 }), makeScene({ order: 1, id: "scene-1" })];
    const provider = new FakeVoiceProvider([succeed]);

    const result = await runVoiceGeneration({ ...BASE, jobId: newTestJobId(), scenes }, provider);

    expect(result.allReady).toBe(true);
    expect(result.scenes.every((s) => s.audio?.status === "ready")).toBe(true);
    expect(provider.calls).toHaveLength(2);
  });

  it("skips scenes that are already READY when not forced", async () => {
    const readyScene = makeScene({ order: 0, audio: { status: "ready", duration: 4, format: "wav", provider: "piper" } });
    const pendingScene = makeScene({ order: 1, id: "scene-1" });
    const provider = new FakeVoiceProvider([succeed]);

    const result = await runVoiceGeneration({ ...BASE, jobId: newTestJobId(), scenes: [readyScene, pendingScene] }, provider);

    expect(provider.calls).toHaveLength(1); // only the pending scene was processed
    expect(result.scenes[0].audio?.duration).toBe(4); // untouched
    expect(result.allReady).toBe(true);
  });

  it("force regenerates every scene even if already READY", async () => {
    const readyScene = makeScene({ order: 0, audio: { status: "ready", duration: 4, format: "wav", provider: "piper" } });
    const provider = new FakeVoiceProvider([succeed]);

    await runVoiceGeneration({ ...BASE, jobId: newTestJobId(), scenes: [readyScene], force: true }, provider);

    expect(provider.calls).toHaveLength(1);
  });

  it("only processes the targeted scene when targetSceneId is set", async () => {
    const scenes = [makeScene({ order: 0 }), makeScene({ order: 1, id: "scene-1" })];
    const provider = new FakeVoiceProvider([succeed]);

    const result = await runVoiceGeneration(
      { ...BASE, jobId: newTestJobId(), scenes, targetSceneId: "scene-1" },
      provider
    );

    expect(provider.calls).toHaveLength(1);
    expect(result.scenes[0].audio).toBeUndefined(); // scene-0 untouched
    expect(result.scenes[1].audio?.status).toBe("ready");
  });

  it("retries a transient failure and succeeds on the second attempt", async () => {
    const scenes = [makeScene({ order: 0 })];
    const provider = new FakeVoiceProvider([() => fail("process_failed"), succeed]);

    const result = await runVoiceGeneration({ ...BASE, jobId: newTestJobId(), scenes }, provider);

    expect(provider.calls).toHaveLength(2);
    expect(result.allReady).toBe(true);
  });

  it("does not retry a non-retryable failure kind", async () => {
    const scenes = [makeScene({ order: 0 })];
    const provider = new FakeVoiceProvider([() => fail("invalid_input")]);

    const result = await runVoiceGeneration({ ...BASE, jobId: newTestJobId(), scenes }, provider);

    expect(provider.calls).toHaveLength(1);
    expect(result.allReady).toBe(false);
  });

  it("reports partial failure without discarding other scenes' audio", async () => {
    const scenes = [makeScene({ order: 0 }), makeScene({ order: 1, id: "scene-1" }), makeScene({ order: 2, id: "scene-2" })];
    let call = 0;
    const provider: VoiceProvider = {
      name: "piper",
      async generateSpeech(input: VoiceInput) {
        call += 1;
        if (call === 2) return Promise.reject(new VoiceProviderError("invalid_input", "scene 2 fails"));
        writeFakeWav(input.outputPath);
        return succeed();
      },
    };

    const result = await runVoiceGeneration({ ...BASE, jobId: newTestJobId(), scenes }, provider);

    expect(result.allReady).toBe(false);
    expect(result.failedSceneIds).toEqual(["scene-1"]);
    expect(result.scenes[0].audio?.status).toBe("ready");
    expect(result.scenes[1].audio?.status).toBe("failed");
    expect(result.scenes[2].audio?.status).toBe("ready");
  });

  it("throws before processing any scene when the voice does not exist", async () => {
    const scenes = [makeScene({ order: 0 })];
    const provider = new FakeVoiceProvider([succeed]);

    await expect(
      runVoiceGeneration({ ...BASE, jobId: newTestJobId(), voiceId: "does-not-exist", scenes }, provider)
    ).rejects.toThrow(VoiceProviderError);
    expect(provider.calls).toHaveLength(0);
  });

  it("throws when the voice does not support the requested language", async () => {
    const scenes = [makeScene({ order: 0 })];
    const provider = new FakeVoiceProvider([succeed]);

    await expect(
      runVoiceGeneration({ ...BASE, jobId: newTestJobId(), language: "ta", scenes }, provider)
    ).rejects.toThrow(/does not support TA/);
    expect(provider.calls).toHaveLength(0);
  });
});

describe("planSfxTriggers — real, sceneRole-driven, never random", () => {
  it("places a whoosh at time 0 for a hook scene", () => {
    const plans = planSfxTriggers("hook", 8);
    expect(plans).toEqual([{ type: "whoosh", offsetSeconds: 0 }]);
  });

  it("places an impact near the end for a reveal scene", () => {
    const plans = planSfxTriggers("reveal", 8);
    expect(plans).toEqual([{ type: "impact", offsetSeconds: 7.6 }]);
  });

  it("never places an SFX before time 0, even for a very short reveal scene", () => {
    const plans = planSfxTriggers("reveal", 0.2);
    expect(plans[0].offsetSeconds).toBeGreaterThanOrEqual(0);
  });

  it("places no SFX for roles other than hook/reveal", () => {
    for (const role of ["fact", "build", "conclusion", "transition", undefined]) {
      expect(planSfxTriggers(role, 8)).toEqual([]);
    }
  });
});

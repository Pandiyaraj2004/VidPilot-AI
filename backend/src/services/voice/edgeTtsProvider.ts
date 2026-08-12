import { mkdtemp, rm, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { config } from "../../config/env.js";
import { transcodeToWav } from "./audioTranscode.js";
import { validateAudioFile } from "./audioValidator.js";
import { getVoiceById } from "./voiceConfig.js";
import { VoiceProviderError, type VoiceInput, type VoiceProvider, type VoiceResult } from "./voiceProvider.js";

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new VoiceProviderError("process_failed", `Edge TTS ${label} timed out after ${timeoutMs}ms.`));
    }, timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

/**
 * Tamil-capable VoiceProvider backed by Microsoft Edge's free "Read Aloud"
 * service (real neural voices, no API key, no payment — reached over a
 * WebSocket, same free service Edge's browser reader uses). This is a
 * network dependency rather than a local binary: it was chosen after the
 * standalone espeak-ng CLI (the local/offline candidate) proved unusable on
 * this machine — see voiceConfig.ts for that investigation. The interface
 * is the same VoiceProvider every other provider implements, so a future
 * local Tamil model can replace this without touching voiceEngine.
 */
export class EdgeTtsProvider implements VoiceProvider {
  readonly name = "edge-tts" as const;

  async generateSpeech(input: VoiceInput): Promise<VoiceResult> {
    const voice = getVoiceById(input.voiceId);
    if (!voice || voice.provider !== "edge-tts") {
      throw new VoiceProviderError("voice_unavailable", `No Edge TTS voice matches "${input.voiceId}".`);
    }

    const text = input.text.trim();
    if (!text) {
      throw new VoiceProviderError("invalid_input", "Narration text is empty.");
    }

    const tmpDir = await mkdtemp(path.join(tmpdir(), "vidpilot-edge-tts-"));
    const tts = new MsEdgeTTS();

    try {
      await withTimeout(
        tts.setMetadata(voice.edgeVoiceName, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3),
        config.edgeTts.timeoutMs,
        "connection"
      );

      // Phase 6 — pitch/volume are real SSML prosody controls Microsoft's
      // service genuinely supports (see ProsodyOptions), unlike Piper which
      // has no such flag — see voiceProvider.ts's VoiceInput comment.
      const { audioFilePath } = await withTimeout(
        tts.toFile(tmpDir, text, {
          rate: input.speed,
          ...(input.pitchHint ? { pitch: input.pitchHint } : {}),
          ...(input.volumeHint ? { volume: input.volumeHint } : {}),
        }),
        config.edgeTts.timeoutMs,
        "synthesis"
      );

      await transcodeToWav(audioFilePath, input.outputPath);
    } catch (err) {
      if (err instanceof VoiceProviderError) throw err;
      throw new VoiceProviderError(
        "process_failed",
        `Edge TTS request failed: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      tts.close();
      await rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
    }

    const validation = await validateAudioFile(input.outputPath);
    if (!validation.valid || !validation.metadata) {
      await unlink(input.outputPath).catch(() => undefined);
      throw new VoiceProviderError("validation_failed", validation.errors.join(" "));
    }

    return {
      provider: "edge-tts",
      audioPath: input.outputPath,
      durationSeconds: validation.metadata.durationSeconds,
      format: "wav",
      sampleRate: validation.metadata.sampleRate,
    };
  }
}

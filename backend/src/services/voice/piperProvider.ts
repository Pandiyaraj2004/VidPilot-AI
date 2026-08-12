import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { config } from "../../config/env.js";
import { validateAudioFile } from "./audioValidator.js";
import { getVoiceById } from "./voiceConfig.js";
import { VoiceProviderError, type VoiceInput, type VoiceProvider, type VoiceResult } from "./voiceProvider.js";

/** Piper's --length_scale stretches phoneme length, so it's the inverse of speaking rate. */
function speedToLengthScale(speed: number): number {
  return 1 / speed;
}

function runPiperProcess(narrationText: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    // Args passed as an array (never a shell string) — narration text goes
    // over stdin, not argv — so nothing in the narration can be interpreted
    // as a shell command regardless of its content.
    const child = spawn(config.piper.executablePath, args, { windowsHide: true });
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(new VoiceProviderError("process_failed", `Piper timed out after ${config.piper.processTimeoutMs}ms.`));
    }, config.piper.processTimeoutMs);

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new VoiceProviderError("process_failed", `Failed to start Piper: ${err.message}`));
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code === 0) {
        resolve();
      } else {
        reject(new VoiceProviderError("process_failed", `Piper exited with code ${code}. ${stderr.trim().slice(-500)}`));
      }
    });

    child.stdin.write(narrationText, "utf-8");
    child.stdin.end();
  });
}

export class PiperProvider implements VoiceProvider {
  readonly name = "piper" as const;

  async generateSpeech(input: VoiceInput): Promise<VoiceResult> {
    if (!existsSync(config.piper.executablePath)) {
      throw new VoiceProviderError(
        "not_installed",
        "Piper is not installed. See the README's Piper setup section."
      );
    }

    const voice = getVoiceById(input.voiceId);
    if (!voice || voice.provider !== "piper") {
      throw new VoiceProviderError("voice_unavailable", `No installed Piper voice matches "${input.voiceId}".`);
    }
    if (!existsSync(voice.modelPath)) {
      throw new VoiceProviderError(
        "voice_unavailable",
        `The voice model for "${voice.label}" is not installed at the expected location.`
      );
    }

    const text = input.text.trim();
    if (!text) {
      throw new VoiceProviderError("invalid_input", "Narration text is empty.");
    }

    const args = [
      "--model",
      voice.modelPath,
      "--config",
      voice.configPath,
      "--espeak_data",
      config.piper.espeakDataPath,
      "--length_scale",
      String(speedToLengthScale(input.speed)),
      // Phase 6's voice engine synthesizes one sentence at a time and
      // splices in its own deliberate, variable-length pauses between them
      // (see audioProcessor.ts) — Piper's own uniform post-sentence silence
      // would double up with that, so it's disabled here.
      "--sentence_silence",
      "0",
      "--output_file",
      input.outputPath,
      "--quiet",
    ];

    await runPiperProcess(text, args);

    const validation = await validateAudioFile(input.outputPath);
    if (!validation.valid || !validation.metadata) {
      await unlink(input.outputPath).catch(() => undefined);
      throw new VoiceProviderError("validation_failed", validation.errors.join(" "));
    }

    return {
      provider: "piper",
      audioPath: input.outputPath,
      durationSeconds: validation.metadata.durationSeconds,
      format: "wav",
      sampleRate: validation.metadata.sampleRate,
    };
  }
}

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { ContentCategory, VideoScene } from "../../types/index.js";
import { mixSceneAudio, type SfxPlacement } from "../audio/audioMixer.js";
import { musicFolderForCategory } from "../audio/contentCategory.js";
import { MusicResolver } from "../audio/musicResolver.js";
import { LocalSfxProvider } from "../audio/sfxProvider.js";
import { assembleSceneAudio } from "./audioProcessor.js";
import { readAudioMetadata } from "./audioMetadata.js";
import { validateAudioFile } from "./audioValidator.js";
import { ensureJobAudioDir, getSceneAudioPath } from "./audioStorage.js";
import { EdgeTtsProvider } from "./edgeTtsProvider.js";
import { segmentNarrationForSynthesis } from "./narrationSegmenter.js";
import { PiperProvider } from "./piperProvider.js";
import { clampSpeed, deriveVoiceDirection, pauseSeconds } from "./voiceDirectionSystem.js";
import { DEFAULT_VOICE_SPEED, getVoiceById, isValidVoiceSpeed, type VoiceOption } from "./voiceConfig.js";
import { VoiceProviderError, type VoiceProvider, type VoiceProviderName } from "./voiceProvider.js";

const musicResolver = new MusicResolver();
const sfxProvider = new LocalSfxProvider();

/**
 * Real (non-random) SFX triggers, driven by sceneRole — the only
 * scene-level signal genuinely available at voice-generation time. Segment/
 * transition data (Phase 5) doesn't exist yet here: visuals are generated
 * later, in the render stage, after voice_ready — using it would mean
 * guessing or restructuring the pipeline order, so this uses what's real
 * and present now instead. "hook" gets a subtle entrance whoosh; "reveal"
 * gets an impact right at its payoff. No other role gets SFX — never one
 * on every scene.
 */
interface SfxTriggerPlan {
  type: string;
  offsetSeconds: number;
}

export function planSfxTriggers(sceneRole: string | undefined, totalDurationSeconds: number): SfxTriggerPlan[] {
  const plans: SfxTriggerPlan[] = [];
  if (sceneRole === "hook") {
    plans.push({ type: "whoosh", offsetSeconds: 0 });
  }
  if (sceneRole === "reveal") {
    plans.push({ type: "impact", offsetSeconds: Math.max(0, totalDurationSeconds - 0.4) });
  }
  return plans;
}

const PREVIEW_TEXT: Record<string, string> = {
  en: "This is a preview of how this voice sounds.",
  hi: "यह इस आवाज़ के नमूने की झलक है।",
  ta: "இது இந்த குரலின் மாதிரி ஒலியாகும்.",
};

/**
 * Synthesizes a short, fixed sample for the voice picker's preview button —
 * no job required, reuses the same provider registry as full generation.
 * Caller is responsible for invoking the returned cleanup once the file has
 * been streamed to the client.
 */
export async function previewVoice(voiceId: string, speed: number): Promise<{ filePath: string; cleanup: () => Promise<void> }> {
  const voice = getVoiceById(voiceId);
  if (!voice) {
    throw new VoiceProviderError("voice_unavailable", `No voice matches "${voiceId}".`);
  }

  const provider = resolveProvider(voice);
  const tempDir = await mkdtemp(path.join(tmpdir(), "vidpilot-voice-preview-"));
  const outputPath = path.join(tempDir, "preview.wav");
  const appliedSpeed = isValidVoiceSpeed(speed) ? speed : DEFAULT_VOICE_SPEED;

  await provider.generateSpeech({
    text: PREVIEW_TEXT[voice.language] ?? PREVIEW_TEXT.en,
    language: voice.language,
    voiceId,
    speed: appliedSpeed,
    outputPath,
  });

  return {
    filePath: outputPath,
    cleanup: () => rm(tempDir, { recursive: true, force: true }).then(() => undefined).catch(() => undefined),
  };
}

/**
 * Which real provider handles which voice is a property of the voice itself
 * (see voiceConfig.ts) — this registry just holds one instance of each so
 * runVoiceGeneration can dispatch per scene's voice without constructing a
 * new provider per call.
 */
const providerRegistry: Record<VoiceProviderName, VoiceProvider> = {
  piper: new PiperProvider(),
  "edge-tts": new EdgeTtsProvider(),
};

function resolveProvider(voice: VoiceOption): VoiceProvider {
  return providerRegistry[voice.provider];
}

const MAX_ATTEMPTS_PER_SCENE = 2;
// Retrying these kinds of failure a second time (or on a scene it already
// failed for) can't succeed — the model/binary/input is what's wrong, not
// transient bad luck — so don't waste an attempt.
const NON_RETRYABLE_KINDS = new Set(["not_installed", "voice_unavailable", "invalid_input"]);

export interface VoiceEngineOptions {
  jobId: string;
  language: string;
  voiceId: string;
  speed: number;
  contentCategory: ContentCategory;
  scenes: VideoScene[];
  /** Regenerate even scenes that are already READY. Always true when targetSceneId is set. */
  force?: boolean;
  /** Limit processing to one scene (used by generateVoiceForScene/regenerateVoiceForScene). */
  targetSceneId?: string;
}

export interface VoiceEngineResult {
  scenes: VideoScene[];
  allReady: boolean;
  totalDurationSeconds: number;
  failedSceneIds: string[];
}

function shouldProcess(scene: VideoScene, options: VoiceEngineOptions): boolean {
  if (options.targetSceneId) return scene.id === options.targetSceneId;
  if (options.force) return true;
  return scene.audio?.status !== "ready";
}

/**
 * Runs Piper for every scene that needs it, never touching scenes that are
 * already READY unless explicitly forced (see shouldProcess). Never
 * regenerates narration — it only ever reads scene.narration, never calls
 * the content engine. A scene that exhausts its retries is marked FAILED
 * without discarding audio already generated for other scenes.
 */
export async function runVoiceGeneration(
  options: VoiceEngineOptions,
  providerOverride?: VoiceProvider
): Promise<VoiceEngineResult> {
  const voice = getVoiceById(options.voiceId);
  if (!voice) {
    throw new VoiceProviderError("voice_unavailable", `No voice matches "${options.voiceId}".`);
  }
  if (voice.language !== options.language) {
    throw new VoiceProviderError(
      "voice_unavailable",
      `"${voice.label}" does not support ${options.language.toUpperCase()}. Install a Piper voice for this language, or choose a different one.`
    );
  }

  const provider = providerOverride ?? resolveProvider(voice);

  await ensureJobAudioDir(options.jobId);

  const updatedScenes: VideoScene[] = [];
  const failedSceneIds: string[] = [];
  let totalDurationSeconds = 0;

  for (const scene of options.scenes) {
    if (!shouldProcess(scene, options)) {
      updatedScenes.push(scene);
      if (scene.audio?.status === "ready" && scene.audio.duration) {
        totalDurationSeconds += scene.audio.duration;
      }
      continue;
    }

    const outputPath = getSceneAudioPath(options.jobId, scene.order);
    let lastErrorMessage = "Voice generation failed for an unknown reason.";
    let succeeded = false;

    const direction = deriveVoiceDirection(scene.emotion, scene.sceneRole);
    const appliedSpeed = clampSpeed(options.speed, direction.speedRange);
    const sentences = segmentNarrationForSynthesis(scene.narration);

    for (let attempt = 0; attempt < MAX_ATTEMPTS_PER_SCENE; attempt++) {
      if (sentences.length === 0) {
        lastErrorMessage = "Scene narration is empty.";
        break; // matches invalid_input's non-retryable behavior without a wasted attempt
      }

      const tempDir = await mkdtemp(path.join(tmpdir(), "vidpilot-voice-sentences-"));
      try {
        // Phase 6: synthesize each sentence separately so a deliberate,
        // content-aware pause (voiceDirectionSystem.ts) can be spliced
        // between them — Piper/Edge TTS have no per-call way to vary pace
        // or insert a non-uniform pause mid-narration.
        const clipPaths: string[] = [];
        for (let i = 0; i < sentences.length; i++) {
          const clipPath = path.join(tempDir, `sentence-${i}.wav`);
          await provider.generateSpeech({
            text: sentences[i].text,
            language: options.language,
            voiceId: options.voiceId,
            speed: appliedSpeed,
            outputPath: clipPath,
            pitchHint: direction.pitchHint,
          });
          clipPaths.push(clipPath);
        }

        const gapSecondsBetween = sentences.slice(0, -1).map((_, i) => {
          let gap = pauseSeconds(direction.pauseAfterSentence);
          const structural = direction.structuralPause;
          if (structural?.position === "after_first" && i === 0) {
            gap = Math.max(gap, pauseSeconds(structural.length));
          }
          if (structural?.position === "before_last" && i === sentences.length - 2) {
            gap = Math.max(gap, pauseSeconds(structural.length));
          }
          return gap;
        });

        const narrationOnlyPath = path.join(tempDir, "narration-assembled.wav");
        await assembleSceneAudio(clipPaths, gapSecondsBetween, narrationOnlyPath);
        const narrationMeta = await readAudioMetadata(narrationOnlyPath);

        // Music: one consistent folder for the whole job, driven by the
        // user-selected content category (not per-scene mood flip-flopping
        // — see contentCategory.ts) — a real track if the manifest has one
        // for this folder, otherwise findTrackForMood returns null and
        // mixSceneAudio just copies narration through untouched.
        const musicFolder = musicFolderForCategory(options.contentCategory);
        const musicTrack = await musicResolver.findTrackForMood(musicFolder, `${options.jobId}:${scene.id}`);

        // SFX: real, sceneRole-driven triggers only (see planSfxTriggers) —
        // resolved against whatever the user has actually placed in the
        // manifest; a plan with no matching file is silently skipped, not
        // guessed.
        const sfxPlans = planSfxTriggers(scene.sceneRole, narrationMeta.durationSeconds);
        const sfxPlacements: SfxPlacement[] = [];
        for (const plan of sfxPlans) {
          const sfx = await sfxProvider.findSfxForType(plan.type, `${options.jobId}:${scene.id}:${plan.type}`);
          if (sfx) sfxPlacements.push({ path: sfx.filePath, offsetSeconds: plan.offsetSeconds });
        }

        const mixResult = await mixSceneAudio({
          narrationPath: narrationOnlyPath,
          musicPath: musicTrack?.filePath,
          sfx: sfxPlacements.length > 0 ? sfxPlacements : undefined,
          outputPath,
        });

        // The assembled file genuinely contains deliberate pauses up to
        // whatever this scene's direction plan called for — validate
        // against that, not a fixed guess (see audioValidator.ts).
        const maxDeliberateGap = gapSecondsBetween.length > 0 ? Math.max(...gapSecondsBetween) : 0;
        const validation = await validateAudioFile(outputPath, {
          maxInternalSilenceSeconds: Math.max(1.0, maxDeliberateGap + 0.5),
        });
        if (!validation.valid || !validation.metadata) {
          throw new VoiceProviderError("validation_failed", validation.errors.join(" "));
        }

        updatedScenes.push({
          ...scene,
          audio: {
            status: "ready",
            path: outputPath,
            duration: validation.metadata.durationSeconds,
            format: validation.metadata.format,
            sampleRate: validation.metadata.sampleRate,
            provider: provider.name,
            emotion: direction.emotion,
            speedApplied: appliedSpeed,
            ...(mixResult.usedMusic
              ? {
                  musicMood: musicTrack?.mood,
                  musicTrack: musicTrack?.title,
                  musicArtist: musicTrack?.artist ?? null,
                  musicSource: musicTrack?.source,
                  musicSourceUrl: musicTrack?.sourceUrl ?? null,
                  musicLicense: musicTrack?.license,
                  musicAttributionRequired: musicTrack?.attributionRequired ?? false,
                  musicAttributionText: musicTrack?.attributionText ?? null,
                }
              : {}),
          },
        });
        totalDurationSeconds += validation.metadata.durationSeconds;
        succeeded = true;
        break;
      } catch (err) {
        lastErrorMessage = err instanceof Error ? err.message : String(err);
        if (err instanceof VoiceProviderError && NON_RETRYABLE_KINDS.has(err.kind)) {
          break;
        }
      } finally {
        await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
      }
    }

    if (!succeeded) {
      failedSceneIds.push(scene.id);
      updatedScenes.push({
        ...scene,
        audio: { status: "failed", error: lastErrorMessage, provider: provider.name },
      });
    }
  }

  return {
    scenes: updatedScenes,
    allReady: failedSceneIds.length === 0,
    totalDurationSeconds,
    failedSceneIds,
  };
}

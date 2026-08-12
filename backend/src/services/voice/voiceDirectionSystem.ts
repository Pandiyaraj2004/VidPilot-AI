/**
 * Voice direction for the Phase 6 expressive audio engine — the same
 * table-driven, deterministic shape as Phase 5's motionSystem.ts/
 * transitionSystem.ts, applied to speech instead of visuals.
 *
 * IMPORTANT — what this genuinely controls: Piper (English/Hindi) exposes
 * only speed (--length_scale) and a uniform pause (--sentence_silence,
 * disabled here — see piperProvider.ts) at the CLI level; no pitch/volume
 * flag exists. Edge TTS (Tamil) genuinely supports pitch/rate/volume via
 * real SSML (msedge-tts's ProsodyOptions). So `pitchHint` below is honored
 * only by EdgeTtsProvider — PiperProvider ignores it. This file never
 * claims emotion is being "performed" beyond pace and pause placement,
 * which both providers can actually do.
 */

import { MAX_VOICE_SPEED, MIN_VOICE_SPEED } from "./voiceConfig.js";

export type NormalizedEmotion =
  | "neutral" | "curiosity" | "surprise" | "excitement" | "motivation" | "inspiring"
  | "serious" | "mystery" | "suspense" | "happy" | "sad" | "calm" | "dramatic"
  | "confident" | "urgent";

export type PauseLength = "none" | "short" | "medium" | "long" | "dramatic";

/** Seconds of silence for each pause tier — a guideline, not a hard requirement (matches the ranges given for this phase). */
export function pauseSeconds(length: PauseLength | null | undefined): number {
  switch (length) {
    case "short": return 0.25;
    case "medium": return 0.45;
    case "long": return 0.8;
    case "dramatic": return 1.3;
    case "none":
    default: return 0;
  }
}

/**
 * Synonym table normalizing whatever free-text emotion the AI content
 * engine produced (Phase 5's own 10-value vocabulary plus common variants)
 * onto this phase's fixed vocabulary. Checked as an exact match first, then
 * as a substring match (so "very excited"/"high excitement" both resolve),
 * falling back to "neutral" rather than letting an unrecognized string
 * reach the audio pipeline unnormalized.
 */
const EMOTION_SYNONYMS: [string, NormalizedEmotion][] = [
  ["curiosity", "curiosity"], ["curious", "curiosity"],
  ["motivation", "motivation"], ["motivational", "motivation"], ["motivating", "motivation"],
  ["mystery", "mystery"], ["mysterious", "mystery"],
  ["excitement", "excitement"], ["excited", "excitement"], ["exciting", "excitement"],
  ["energetic", "excitement"], ["energy", "excitement"], ["energised", "excitement"], ["energized", "excitement"],
  ["calm", "calm"], ["peaceful", "calm"], ["relaxed", "calm"],
  ["dramatic", "dramatic"], ["drama", "dramatic"],
  ["informative", "neutral"], ["informational", "neutral"], ["neutral", "neutral"],
  ["surprise", "surprise"], ["surprising", "surprise"], ["surprised", "surprise"],
  ["serious", "serious"],
  ["humorous", "happy"], ["humor", "happy"], ["funny", "happy"],
  ["happy", "happy"], ["joyful", "happy"], ["joy", "happy"], ["upbeat", "happy"],
  ["sad", "sad"], ["somber", "sad"], ["melancholy", "sad"],
  ["inspiring", "inspiring"], ["inspirational", "inspiring"], ["uplifting", "inspiring"],
  ["suspense", "suspense"], ["suspenseful", "suspense"], ["tense", "suspense"], ["tension", "suspense"],
  ["confident", "confident"], ["confidence", "confident"],
  ["urgent", "urgent"], ["urgency", "urgent"],
];

export function normalizeEmotion(raw: string | undefined): NormalizedEmotion {
  if (!raw) return "neutral";
  const key = raw.trim().toLowerCase();

  for (const [syn, norm] of EMOTION_SYNONYMS) {
    if (key === syn) return norm;
  }
  for (const [syn, norm] of EMOTION_SYNONYMS) {
    if (key.includes(syn)) return norm;
  }
  return "neutral";
}

interface EmotionDelivery {
  /** [min, max] speed multiplier this emotion is comfortable at — the job's base speed is nudged into this range, then clamped to the global safe range. */
  speedRange: [number, number];
  pauseAfterSentence: PauseLength;
  /** Edge TTS only (see file header) — a real SSML pitch value (e.g. "+5%", "-5%") or undefined for no adjustment. */
  pitchHint?: string;
}

const EMOTION_DELIVERY: Record<NormalizedEmotion, EmotionDelivery> = {
  neutral:     { speedRange: [0.95, 1.10], pauseAfterSentence: "short" },
  curiosity:   { speedRange: [0.95, 1.15], pauseAfterSentence: "short", pitchHint: "+5%" },
  surprise:    { speedRange: [1.00, 1.20], pauseAfterSentence: "short", pitchHint: "+8%" },
  excitement:  { speedRange: [1.05, 1.25], pauseAfterSentence: "short", pitchHint: "+10%" },
  motivation:  { speedRange: [1.00, 1.20], pauseAfterSentence: "short", pitchHint: "+5%" },
  inspiring:   { speedRange: [0.95, 1.15], pauseAfterSentence: "medium", pitchHint: "+3%" },
  serious:     { speedRange: [0.90, 1.05], pauseAfterSentence: "medium" },
  mystery:     { speedRange: [0.85, 1.00], pauseAfterSentence: "medium", pitchHint: "-5%" },
  suspense:    { speedRange: [0.85, 1.00], pauseAfterSentence: "long", pitchHint: "-5%" },
  happy:       { speedRange: [1.00, 1.20], pauseAfterSentence: "short", pitchHint: "+5%" },
  sad:         { speedRange: [0.85, 1.00], pauseAfterSentence: "medium", pitchHint: "-5%" },
  calm:        { speedRange: [0.90, 1.05], pauseAfterSentence: "medium" },
  dramatic:    { speedRange: [0.85, 1.05], pauseAfterSentence: "long", pitchHint: "-3%" },
  confident:   { speedRange: [0.95, 1.15], pauseAfterSentence: "short" },
  urgent:      { speedRange: [1.10, 1.30], pauseAfterSentence: "none" },
};

/** Where a scene's structural pause (beyond the per-sentence default) lands, keyed by sceneRole. */
export interface StructuralPause {
  position: "after_first" | "before_last";
  length: PauseLength;
}

const STRUCTURAL_PAUSE_BY_ROLE: Partial<Record<string, StructuralPause>> = {
  hook: { position: "after_first", length: "short" },
  question: { position: "after_first", length: "medium" },
  clue: { position: "after_first", length: "medium" },
  reveal: { position: "before_last", length: "dramatic" },
};

export interface VoiceDirection {
  emotion: NormalizedEmotion;
  speedRange: [number, number];
  pauseAfterSentence: PauseLength;
  structuralPause: StructuralPause | null;
  pitchHint?: string;
}

export function deriveVoiceDirection(
  rawEmotion: string | undefined,
  sceneRole: string | undefined
): VoiceDirection {
  const emotion = normalizeEmotion(rawEmotion);
  const delivery = EMOTION_DELIVERY[emotion];
  return {
    emotion,
    speedRange: delivery.speedRange,
    pauseAfterSentence: delivery.pauseAfterSentence,
    structuralPause: sceneRole ? STRUCTURAL_PAUSE_BY_ROLE[sceneRole] ?? null : null,
    pitchHint: delivery.pitchHint,
  };
}

/** Nudges the job's own base speed into the emotion's comfortable range, then clamps to the global safe bounds — the user's choice is respected, never silently overridden outside those bounds. */
export function clampSpeed(base: number, range: [number, number]): number {
  const [rangeMin, rangeMax] = range;
  const nudged = Math.min(Math.max(base, rangeMin), rangeMax);
  return Math.min(Math.max(nudged, MIN_VOICE_SPEED), MAX_VOICE_SPEED);
}

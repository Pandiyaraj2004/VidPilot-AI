export interface VoiceInput {
  text: string;
  language: string;
  voiceId: string;
  speed: number;
  /** Server-computed destination path (see audioStorage.ts) — never derived from user input. */
  outputPath: string;
  /**
   * Phase 6 — a real SSML pitch value (e.g. "+5%", "-5%"), from
   * voiceDirectionSystem.ts. Only EdgeTtsProvider honors this (Microsoft's
   * service genuinely supports SSML pitch); PiperProvider has no pitch
   * control at the CLI level and ignores it rather than pretending to
   * apply it — see that file's header comment.
   */
  pitchHint?: string;
  /** Phase 6 — same honesty caveat as pitchHint; edge-tts only. */
  volumeHint?: string;
}

export type VoiceProviderName = "piper" | "edge-tts";

export interface VoiceResult {
  provider: VoiceProviderName;
  audioPath: string;
  durationSeconds: number;
  format: "wav";
  sampleRate: number;
}

export interface VoiceProvider {
  readonly name: VoiceProviderName;
  generateSpeech(input: VoiceInput): Promise<VoiceResult>;
}

export type VoiceFailureKind =
  | "not_installed"
  | "voice_unavailable"
  | "invalid_input"
  | "process_failed"
  | "validation_failed";

/** Thrown by voice providers — message is safe to store/show; never contains a raw shell command or file contents. */
export class VoiceProviderError extends Error {
  readonly kind: VoiceFailureKind;

  constructor(kind: VoiceFailureKind, message: string) {
    super(message);
    this.name = "VoiceProviderError";
    this.kind = kind;
  }
}

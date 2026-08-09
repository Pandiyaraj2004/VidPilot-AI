export interface VoiceSynthesisRequest {
  text: string;
  voice: string;
}

export interface VoiceSynthesisResult {
  audioUrl: string;
  durationSeconds: number;
}

/** Piper TTS integration placeholder — real synthesis ships in Phase 4. */
export const voiceService = {
  async synthesize(_request: VoiceSynthesisRequest): Promise<VoiceSynthesisResult> {
    throw new Error("Voice synthesis is not connected yet. It ships in Phase 4.");
  },
};

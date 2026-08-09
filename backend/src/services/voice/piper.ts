export interface VoiceSynthesisRequest {
  text: string;
  voice: string;
}

export interface VoiceSynthesisResult {
  audioFilePath: string;
  durationSeconds: number;
}

/**
 * Placeholder for the Piper TTS integration. Real synthesis (and measuring
 * actual audio duration instead of estimating from word count) is Phase 4 work.
 */
export class PiperVoiceService {
  async synthesize(_request: VoiceSynthesisRequest): Promise<VoiceSynthesisResult> {
    throw new Error("PiperVoiceService.synthesize() is not implemented yet. Ships in Phase 4.");
  }
}

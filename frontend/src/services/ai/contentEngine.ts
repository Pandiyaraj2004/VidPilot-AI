import type { Scene, VideoStyle } from "@/types";

export interface ContentGenerationRequest {
  topic: string;
  script?: string;
  style: VideoStyle;
  durationSeconds: number;
  language: string;
  voice: string;
}

export interface ContentGenerationResult {
  title: string;
  hook: string;
  description: string;
  tags: string[];
  scenes: Scene[];
}

/**
 * Provider-agnostic entry point for script/scene generation. UI code should
 * depend on this contract rather than a specific AI vendor — Gemini and
 * OpenRouter providers land behind it in Phase 3.
 */
export const contentEngine = {
  async generate(_request: ContentGenerationRequest): Promise<ContentGenerationResult> {
    throw new Error("The AI content engine is not connected yet. It ships in Phase 3.");
  },
};

import type { Scene, VideoStyle } from "../../types/index.js";

export interface ContentGenerationRequest {
  topic: string;
  style: VideoStyle;
  durationSeconds: number;
}

export interface ContentGenerationResult {
  title: string;
  hook: string;
  description: string;
  tags: string[];
  scenes: Scene[];
}

export interface ContentProvider {
  readonly name: string;
  generate(request: ContentGenerationRequest): Promise<ContentGenerationResult>;
}

/**
 * Provider-agnostic entry point for script/scene generation. Phase 1 only
 * defines the shape so UI and job-orchestration code can depend on this
 * interface instead of a specific AI vendor. GeminiProvider/OpenRouterProvider
 * implementations land in Phase 3.
 */
export class ContentEngine {
  constructor(private readonly providers: ContentProvider[]) {}

  async generate(_request: ContentGenerationRequest): Promise<ContentGenerationResult> {
    throw new Error(
      `ContentEngine.generate() is not implemented yet (${this.providers.length} providers registered). AI content generation ships in Phase 3.`
    );
  }
}

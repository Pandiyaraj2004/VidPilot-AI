export interface RenderRequest {
  jobId: string;
}

export interface RenderResult {
  videoFilePath: string;
  durationSeconds: number;
}

/**
 * Placeholder for the Remotion + FFmpeg rendering pipeline (Phase 5).
 */
export class RendererService {
  async render(_request: RenderRequest): Promise<RenderResult> {
    throw new Error("RendererService.render() is not implemented yet. Ships in Phase 5.");
  }
}

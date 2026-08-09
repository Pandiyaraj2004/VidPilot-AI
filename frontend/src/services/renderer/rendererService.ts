export interface RenderResult {
  videoUrl: string;
  durationSeconds: number;
}

/** Remotion + FFmpeg render pipeline placeholder — ships in Phase 5. */
export const rendererService = {
  async render(_jobId: string): Promise<RenderResult> {
    throw new Error("Video rendering is not connected yet. It ships in Phase 5.");
  },
};

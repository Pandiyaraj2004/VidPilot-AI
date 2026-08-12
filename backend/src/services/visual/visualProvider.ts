import type { CameraMotion, CaptionStyle, VideoStyle, VisualAssetMetadata, VisualSegment, VisualStyle, VisualTemplate } from "../../types/index.js";

export interface VisualInput {
  sceneId: string;
  sceneOrder: number;
  jobId: string;
  narration: string;
  onScreenText: string;
  visualDescription: string;
  language: string;
  jobStyle: VideoStyle;
  visualStyleSetting: VisualStyle;
  // Phase 5 — real audio duration (enables multi-segment timing)
  audioDuration?: number;
  // Phase 5 — scene-level metadata from AI
  emotion?: string;
  energy?: number;
  sceneRole?: string;
  highlightWords?: string[];
  musicMood?: string;
  // Phase 5 upgrade — internet visual sourcing
  /** AI-supplied search phrases (falls back to a local heuristic when absent). */
  visualKeywords?: string[];
  /** `${provider}:${sourceId}` keys already used earlier in this job — avoided when an alternative candidate exists. */
  recentSourceKeys?: string[];
  /** Set once a job's visual-asset budget (config.visuals.maxAssetsPerJob) is reached — skips internet lookups entirely and uses the procedural fallback, rather than quietly still calling provider APIs. */
  skipInternetSearch?: boolean;
  // Phase 8 — cross-scene camera-motion continuity
  /** The immediately preceding scene's last segment's camera motion, so this scene's first segment can avoid an immediate repeat right at the cut. Absent for the job's first scene. */
  previousSceneLastMotion?: CameraMotion;
}

export interface VisualResult {
  template: VisualTemplate;
  backgroundKind: "gradient" | "solid" | "pattern";
  colors: string[];
  accentColor: string;
  /** Phase 5: multi-segment visual timeline. When present, the renderer uses these instead of the single-background fallback. */
  segments?: VisualSegment[];
  /** Every internet asset actually used by this scene's segments. */
  assets?: VisualAssetMetadata[];
  /** `${provider}:${sourceId}` keys used by this scene — the caller folds these into the next scene's recentSourceKeys. */
  usedSourceKeys?: string[];
  /** Scene emotion that drove the visual plan. Stored on SceneVisual for debugging / UI display. */
  emotion?: string;
  /** Caption layout variant derived from sceneRole + energy. */
  captionStyle?: CaptionStyle;
}

export type VisualFailureKind = "invalid_input" | "generation_failed";

/** Message is safe to store/show. */
export class VisualProviderError extends Error {
  readonly kind: VisualFailureKind;

  constructor(kind: VisualFailureKind, message: string) {
    super(message);
    this.name = "VisualProviderError";
    this.kind = kind;
  }
}

/**
 * A provider assigns a scene its visual treatment. The MVP implementation
 * (LocalVisualProvider) is entirely deterministic/local — gradients, solid
 * fills, and a handful of hand-picked palettes, no paid AI image API. A
 * future AI-image provider (e.g. one that calls an image-generation model
 * per scene) implements this same interface and slots into visualEngine.ts
 * without changing anything downstream — the renderer only ever consumes
 * VisualResult, never which provider produced it.
 */
export interface VisualProvider {
  readonly name: string;
  generateVisual(input: VisualInput): Promise<VisualResult>;
}

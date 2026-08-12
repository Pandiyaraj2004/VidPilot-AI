import path from "node:path";
import { bundle } from "@remotion/bundler";
import { openBrowser, renderMedia, selectComposition, type HeadlessBrowser } from "@remotion/renderer";
import { config } from "../../config/env.js";
import type { CaptionStyle, SubtitleCue, VisualSegment, VisualTemplate } from "../../types/index.js";

const COMPOSITION_ID = "Scene";

let cachedBundleUrl: string | null = null;

/** Bundling is expensive (webpack) and the composition source never changes at runtime, so bundle once per process and reuse it for every scene render — exported so thumbnailRenderer.ts (Phase 11) can render the same project's "Thumbnail" composition without a second, separate bundle. */
export async function getBundleUrl(): Promise<string> {
  if (cachedBundleUrl) return cachedBundleUrl;
  const remotionDir = path.join(process.cwd(), "remotion");
  cachedBundleUrl = await bundle({
    entryPoint: path.join(remotionDir, "index.ts"),
    // Without this, @remotion/bundler walks up to the nearest package.json
    // (backend/package.json) and looks for a "public" folder next to it,
    // missing remotion/public/ entirely — fonts would 404 at render time.
    publicDir: path.join(remotionDir, "public"),
  });
  return cachedBundleUrl;
}

export interface RenderSceneInput {
  outputPath: string;
  durationInSeconds: number;
  template: VisualTemplate;
  backgroundKind: "gradient" | "solid" | "pattern";
  colors: [string, string];
  accentColor: string;
  onScreenText: string;
  language: string;
  subtitles: SubtitleCue[];
  /**
   * An http(s) URL, not a filesystem path. Remotion's headless Chrome
   * fetches <Audio src> over HTTP; a raw local path (or a file:// URL)
   * fails because Remotion's asset pipeline only downloads http(s). In
   * practice this is the backend's own existing scene-audio route
   * (GET /api/jobs/:id/scenes/:sceneId/audio) — the same
   * server-resolves-the-path-never-trusts-the-client endpoint Phase 4
   * already serves narration audio through.
   */
  audioUrl: string;
  // Phase 5 — multi-segment visual timeline. mediaUrl is resolved by
  // renderEngine.ts from each segment's assetId (same http(s)-URL
  // requirement as audioUrl above) — never a raw filesystem path.
  segments?: (VisualSegment & { mediaUrl?: string })[];
  // Phase 5 — scene-level metadata
  emotion?: string;
  sceneRole?: string;
  highlightWords?: string[];
  captionStyle?: CaptionStyle;
  /** 0.0–1.0, drives caption reveal pacing (Phase 7) same as it already drives visual motion/transitions. */
  energy?: number;
}

class AsyncMutex {
  private queue: Promise<void> = Promise.resolve();

  async acquire(): Promise<() => void> {
    let release: () => void;
    const next = new Promise<void>((resolve) => {
      release = resolve;
    });
    const current = this.queue;
    this.queue = next;
    await current;
    return release!;
  }
}

const renderMutex = new AsyncMutex();

/**
 * Opens one headless Chrome instance and hands it to `render` for reuse
 * across every scene in a job, then closes it. Wrapped in a Mutex so that
 * multiple jobs rendering concurrently queue up and render sequentially,
 * avoiding parallel Puppeteer rendering from overloading CPU/RAM.
 */
export async function withRenderBrowser<T>(render: (browser: HeadlessBrowser) => Promise<T>): Promise<T> {
  const release = await renderMutex.acquire();
  try {
    const browser = await openBrowser("chrome", { browserExecutable: config.rendering.chromiumExecutablePath ?? undefined });
    try {
      return await render(browser);
    } finally {
      await browser.close({ silent: true });
    }
  } finally {
    release();
  }
}

/**
 * Renders one scene to a standalone H.264/AAC MP4, audio muxed in by
 * Remotion itself. Deliberately does NOT point Remotion at our own
 * downloaded ffmpeg (config.ffmpeg.*, used elsewhere for audio transcode
 * and final concatenation) — Remotion's own compositor package
 * (@remotion/compositor-win32-x64-msvc) bundles its own matched
 * ffmpeg/ffprobe/compositor triplet, and overriding binariesDirectory
 * requires supplying all three, not just ffmpeg.
 */
export async function renderScene(input: RenderSceneInput, browser: HeadlessBrowser): Promise<void> {
  const serveUrl = await getBundleUrl();

  const inputProps = {
    durationInSeconds: input.durationInSeconds,
    // Shorts upgrade — the composition's real dimensions come from here,
    // not a hardcoded constant in Root.tsx; see that file's
    // calculateMetadata. Switching a deployment to 16:9 landscape is a
    // config/env.ts change (VIDEO_WIDTH/VIDEO_HEIGHT), nothing else.
    videoWidth: config.rendering.width,
    videoHeight: config.rendering.height,
    template: input.template,
    backgroundKind: input.backgroundKind,
    colors: input.colors,
    accentColor: input.accentColor,
    onScreenText: input.onScreenText,
    language: input.language,
    subtitles: input.subtitles,
    audioSrc: input.audioUrl,
    // Phase 5 — new optional fields
    segments: input.segments ?? null,
    emotion: input.emotion ?? null,
    sceneRole: input.sceneRole ?? null,
    highlightWords: input.highlightWords ?? null,
    captionStyle: input.captionStyle ?? null,
    // Phase 7 — real per-scene energy for caption reveal pacing (previously only used by motionSystem/transitionSystem on the visual-planning side, never threaded into the renderer itself).
    energy: input.energy ?? null,
  };

  const composition = await selectComposition({
    serveUrl,
    id: COMPOSITION_ID,
    inputProps,
    puppeteerInstance: browser,
    timeoutInMilliseconds: config.rendering.renderTimeoutMs,
  });

  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation: input.outputPath,
    inputProps,
    puppeteerInstance: browser,
    timeoutInMilliseconds: config.rendering.renderTimeoutMs,
    overwrite: true,
    enforceAudioTrack: true,
  });
}

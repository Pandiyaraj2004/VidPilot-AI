import { AbsoluteFill, Audio, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
// Webpack asset imports (not staticFile()) — these fonts live outside the
// public/ folder, next to the composition source, and webpack resolves
// each to a content-hashed URL inside the bundle automatically.
// @ts-expect-error -- .ttf has no type declaration; webpack's asset/resource loader handles it.
import notoSansEnglishUrl from "../assets/fonts/english/NotoSans-Variable.ttf";
// @ts-expect-error -- .ttf has no type declaration; webpack's asset/resource loader handles it.
import notoSansHindiUrl from "../assets/fonts/hindi/NotoSansDevanagari-Variable.ttf";
// @ts-expect-error -- .ttf has no type declaration; webpack's asset/resource loader handles it.
import notoSansTamilUrl from "../assets/fonts/tamil/NotoSansTamil-Variable.ttf";
import { VisualSegmentLayer, type VisualSegmentProp } from "./components/VisualSegmentLayer";
import { DynamicCaption, type SubtitleCueProp } from "./components/DynamicCaption";
import { HookOverlay } from "./components/HookOverlay";
import { getHorizontalMarginPx, getTitleBand } from "./layout/safeZones";

export type VisualTemplate = "documentary" | "explainer" | "listicle" | "facts" | "cartoon";
export type CaptionStyle = "normal" | "hook" | "emphasis" | "reveal" | "question";

export interface SceneCompositionProps {
  durationInSeconds: number;
  // Shorts-upgrade: the composition's real dimensions, read by
  // Root.tsx's calculateMetadata — every layout component below derives
  // its own proportions from useVideoConfig() rather than hardcoding
  // pixels, so this is the only place a format actually gets chosen
  // (see config.rendering.width/height in remotionRenderer.ts).
  videoWidth: number;
  videoHeight: number;
  // --- Legacy single-background fields (kept for old-job fallback) ---
  template: VisualTemplate;
  backgroundKind: "gradient" | "solid" | "pattern";
  colors: [string, string];
  accentColor: string;
  onScreenText: string;
  language: string;
  subtitles: SubtitleCueProp[];
  /** An http(s) URL — see remotionRenderer.ts for why this can't be a raw filesystem path. */
  audioSrc: string;
  // --- Phase 5: multi-segment visual timeline (null = use legacy fallback) ---
  segments: VisualSegmentProp[] | null;
  emotion: string | null;
  /** 0.0–1.0. Phase 7: drives HookOverlay/DynamicCaption reveal pacing the same way it already drives visual motion/transitions (services/visual/motionSystem.ts). Absent on old jobs — components default to 0.5, same convention as the visual-planning side. */
  energy: number | null;
  sceneRole: string | null;
  highlightWords: string[] | null;
  captionStyle: CaptionStyle | null;
}

export const defaultSceneProps: SceneCompositionProps = {
  durationInSeconds: 5,
  videoWidth: 1080,
  videoHeight: 1920,
  template: "documentary",
  backgroundKind: "gradient",
  colors: ["#312e81", "#7c3aed"],
  accentColor: "#facc15",
  onScreenText: "VidPilot AI",
  language: "en",
  subtitles: [],
  audioSrc: "",
  segments: null,
  emotion: null,
  energy: null,
  sceneRole: null,
  highlightWords: null,
  captionStyle: null,
};

const FONT_BY_LANGUAGE: Record<string, string> = {
  en: "VidPilot Sans English",
  hi: "VidPilot Sans Hindi",
  ta: "VidPilot Sans Tamil",
};

function fontFamilyFor(language: string): string {
  return FONT_BY_LANGUAGE[language] ?? FONT_BY_LANGUAGE.en;
}

const FONT_FACE_CSS = `
  @font-face {
    font-family: "VidPilot Sans English";
    src: url("${notoSansEnglishUrl}") format("truetype");
    font-weight: 100 900;
  }
  @font-face {
    font-family: "VidPilot Sans Hindi";
    src: url("${notoSansHindiUrl}") format("truetype");
    font-weight: 100 900;
  }
  @font-face {
    font-family: "VidPilot Sans Tamil";
    src: url("${notoSansTamilUrl}") format("truetype");
    font-weight: 100 900;
  }
`;

// =============================================================================
// Legacy single-background rendering (Phase 5 MVP fallback)
// Used when props.segments is null/empty — keeps old jobs rendering correctly.
// =============================================================================

function legacyBackground(props: SceneCompositionProps): string {
  const [from, to] = props.colors;
  if (props.backgroundKind === "solid") return from;
  if (props.backgroundKind === "pattern") {
    return `repeating-linear-gradient(45deg, ${from} 0px, ${from} 40px, ${to} 40px, ${to} 80px)`;
  }
  return `linear-gradient(135deg, ${from} 0%, ${to} 100%)`;
}

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  return hash;
}

/** All coordinates are fractions of the real composition width/height (useVideoConfig) — never fixed 1920x1080 pixels, so this reads correctly at any aspect ratio, portrait included. */
function LegacyShapeLayer({
  template,
  accentColor,
  seed,
  width,
  height,
}: {
  template: VisualTemplate;
  accentColor: string;
  seed: string;
  width: number;
  height: number;
}) {
  const h = hashString(seed);
  if (template === "cartoon") {
    const cx = width * (0.1 + ((h % 300) / 300) * 0.15);
    const cy = height * (0.15 + (((h >> 4) % 300) / 300) * 0.15);
    return (
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity: 0.9 }}>
        <circle cx={cx} cy={cy} r={width * 0.047} fill={accentColor} opacity={0.35} />
        <circle cx={width - cx} cy={height - cy} r={width * 0.073} fill={accentColor} opacity={0.25} />
        <polygon
          points={`${cx + width * 0.21},${cy + height * 0.05} ${cx + width * 0.26},${cy + height * 0.14} ${cx + width * 0.16},${cy + height * 0.14}`}
          fill={accentColor}
          opacity={0.3}
        />
      </svg>
    );
  }
  if (template === "listicle") {
    return (
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity: 0.5 }}>
        {[0, 1, 2, 3].map((i) => (
          <rect
            key={i}
            x={width * 0.0625}
            y={height * (0.14 + i * 0.09)}
            width={((h >> i) % 6) * (width * 0.03) + width * 0.16}
            height={height * 0.01}
            rx={height * 0.005}
            fill={accentColor}
            opacity={0.25}
          />
        ))}
      </svg>
    );
  }
  if (template === "facts") {
    const cx = width * 0.83;
    const cy = height * 0.11;
    return (
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity: 0.5 }}>
        <circle cx={cx} cy={cy} r={width * 0.115} stroke={accentColor} strokeWidth={width * 0.0021} fill="none" opacity={0.4} />
        <circle cx={cx} cy={cy} r={width * 0.073} stroke={accentColor} strokeWidth={width * 0.0016} fill="none" opacity={0.3} />
      </svg>
    );
  }
  return (
    <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity: 0.35 }}>
      <rect x={0} y={height * 0.833} width={width} height={height * 0.167} fill={accentColor} opacity={0.15} />
    </svg>
  );
}

// =============================================================================
// Main composition
// =============================================================================

export function SceneComposition(props: SceneCompositionProps) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const fontFamily = fontFamilyFor(props.language);
  const currentSeconds = frame / fps;

  // Determine if this is a hook scene (affects HookOverlay and caption style)
  const isHookScene = props.sceneRole === "hook";

  // Determine active segment's accent colour (for dynamic caption highlighting)
  // Falls back to the legacy props.accentColor when using the single-background path
  const activeSegment = props.segments
    ? props.segments.find((s) => currentSeconds >= s.startTime && currentSeconds <= s.endTime)
    : null;
  const activeAccent = activeSegment?.accentColor ?? props.accentColor;

  const hasSegments = props.segments && props.segments.length > 0;

  // Legacy entrance animation (only used in the fallback single-background path)
  const legacyEntrance = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ fontFamily }}>
      <style>{FONT_FACE_CSS}</style>

      {/* Audio — always present */}
      {props.audioSrc ? <Audio src={props.audioSrc} /> : null}

      {/* ================================================================
          PHASE 5 PATH: Multi-segment visual timeline
          ================================================================ */}
      {hasSegments && (
        <>
          {props.segments!.map((segment) => (
            <VisualSegmentLayer key={segment.id} segment={segment} />
          ))}

          {/* Hook overlay — large staggered entrance text for the first scene.
              Real per-scene energy (previously hardcoded to 0.8 for every
              scene) now drives both its font size and, via
              getCaptionPacing() inside HookOverlay itself, its reveal speed. */}
          <HookOverlay
            onScreenText={props.onScreenText}
            accentColor={activeAccent}
            fontFamily={fontFamily}
            sceneRole={props.sceneRole}
            emotion={props.emotion}
            energy={props.energy ?? 0.5}
          />

          {/* On-screen text (non-hook scenes) — confined to the title band so it can never compete with DynamicCaption's bottom-anchored region. */}
          {!isHookScene && props.onScreenText && (
            <div
              style={{
                position: "absolute",
                top: getTitleBand(height).top,
                height: getTitleBand(height).height,
                left: getHorizontalMarginPx(width),
                right: getHorizontalMarginPx(width),
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                opacity: legacyEntrance,
                transform: `translateY(${(1 - legacyEntrance) * 30}px)`,
              }}
            >
              <div
                style={{
                  color: "#ffffff",
                  fontSize: width * 0.0525,
                  fontWeight: 700,
                  textAlign: "center",
                  textShadow: "0 4px 24px rgba(0,0,0,0.45)",
                  lineHeight: 1.25,
                  opacity: 0.9,
                }}
              >
                {props.onScreenText}
              </div>
            </div>
          )}

          {/* Dynamic caption with word-by-word kinetic reveal and emphasis pop */}
          <DynamicCaption
            subtitles={props.subtitles}
            highlightWords={props.highlightWords}
            captionStyle={props.captionStyle}
            accentColor={activeAccent}
            fontFamily={fontFamily}
            isHookScene={isHookScene}
            emotion={props.emotion}
            energy={props.energy}
            sceneRole={props.sceneRole}
          />
        </>
      )}

      {/* ================================================================
          LEGACY FALLBACK PATH: Single background (for old jobs / no segments)
          Preserves exact behaviour from Phase 5 MVP — nothing breaks.
          ================================================================ */}
      {!hasSegments && (
        <>
          <AbsoluteFill style={{ background: legacyBackground(props) }}>
            <LegacyShapeLayer template={props.template} accentColor={props.accentColor} seed={props.onScreenText} width={width} height={height} />
          </AbsoluteFill>

          <div
            style={{
              position: "absolute",
              top: getTitleBand(height).top,
              height: getTitleBand(height).height,
              left: getHorizontalMarginPx(width),
              right: getHorizontalMarginPx(width),
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              opacity: legacyEntrance,
              transform: `translateY(${(1 - legacyEntrance) * 30}px)`,
            }}
          >
            <div
              style={{
                color: "#ffffff",
                fontSize: width * 0.0555,
                fontWeight: 700,
                textAlign: "center",
                textShadow: "0 4px 24px rgba(0,0,0,0.45)",
                lineHeight: 1.25,
              }}
            >
              {props.onScreenText}
            </div>
          </div>

          {/* Subtitle bar, legacy path — still gets word-by-word reveal; no
              segments/energy exist here so pacing falls back to the
              medium-energy default inside DynamicCaption/getCaptionPacing. */}
          <DynamicCaption
            subtitles={props.subtitles}
            highlightWords={null}
            captionStyle="normal"
            accentColor={props.accentColor}
            fontFamily={fontFamily}
            isHookScene={false}
            emotion={props.emotion}
            energy={props.energy}
            sceneRole={props.sceneRole}
          />
        </>
      )}
    </AbsoluteFill>
  );
}

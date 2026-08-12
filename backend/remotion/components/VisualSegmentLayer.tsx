/**
 * VisualSegmentLayer — renders one VisualSegment within a scene's timeline.
 *
 * Each segment has its own:
 *   - Background (gradient/solid/pattern) with the segment's colour palette
 *   - Camera motion applied as CSS transform (zoom/pan/scale)
 *   - Crossfade opacity envelope so adjacent segments fade into each other
 *   - Optional content overlay (statistic card, text card, quote card)
 *   - SVG shape decorations (template-specific geometric elements)
 *
 * The crossfade prevents jarring hard-cuts between segments within a scene.
 * The camera motion makes each segment feel alive without requiring
 * expensive per-frame computation beyond simple interpolation.
 */

import { AbsoluteFill, Img, interpolate, OffthreadVideo, useCurrentFrame, useVideoConfig } from "remotion";
import { ContentOverlay } from "./ContentOverlay";

export interface VisualSegmentProp {
  id: string;
  startTime: number;
  endTime: number;
  /** "color" renders the gradient/solid/pattern background below; "image"/"video" render mediaUrl instead, with the same colors used as a loading/letterbox fill. */
  mediaKind: "color" | "image" | "video";
  backgroundKind: "gradient" | "solid" | "pattern";
  colors: [string, string];
  accentColor: string;
  cameraMotion: string;
  /** How this segment blends in from the previous one. Redeclared locally rather than imported from backend/src — see transitionFadeFrames below, matching this file's existing convention of not depending on backend/src types. */
  transition: "cut" | "crossfade" | "fade" | "zoom" | "slide";
  /** Resolved by renderEngine.ts from the segment's assetId — an http(s) URL Remotion's headless Chrome can fetch, same as the existing scene-audio URL. Present only when mediaKind is "image"/"video". */
  mediaUrl?: string;
  contentType: "none" | "text_card" | "statistic" | "quote";
  contentValue?: string;
  contentLabel?: string;
}

/** Crossfade-blend frame count per transition type. "cut" is a hard 0 by design — see transitionSystem.ts on the backend, which this mirrors. */
function transitionFadeFrames(transition: VisualSegmentProp["transition"]): number {
  switch (transition) {
    case "cut": return 0;
    case "crossfade": return 8;
    case "fade": return 14;
    case "zoom": return 6;
    case "slide": return 8;
    default: return 8;
  }
}

/** Whether this transition adds an extra transform burst at the segment boundary, beyond the plain opacity crossfade. */
function transitionUsesTransformBurst(transition: VisualSegmentProp["transition"]): boolean {
  return transition === "zoom" || transition === "slide";
}

function buildBackground(seg: VisualSegmentProp): string {
  const [from, to] = seg.colors;
  if (seg.backgroundKind === "solid") return from;
  if (seg.backgroundKind === "pattern") {
    return `repeating-linear-gradient(45deg, ${from} 0px, ${from} 40px, ${to} 40px, ${to} 80px)`;
  }
  return `linear-gradient(135deg, ${from} 0%, ${to} 100%)`;
}

/** Applies camera motion transform based on segment-local progress (0→1). */
function buildMotionTransform(motion: string, progress: number): string {
  const p = Math.max(0, Math.min(1, progress));
  switch (motion) {
    case "zoom_in": {
      const scale = 1.0 + 0.12 * p;
      return `scale(${scale.toFixed(4)})`;
    }
    case "zoom_out": {
      const scale = 1.12 - 0.12 * p;
      return `scale(${scale.toFixed(4)})`;
    }
    case "pan_left": {
      const tx = 3 - 6 * p;
      return `scale(1.08) translateX(${tx.toFixed(4)}%)`;
    }
    case "pan_right": {
      const tx = -3 + 6 * p;
      return `scale(1.08) translateX(${tx.toFixed(4)}%)`;
    }
    case "pan_up": {
      const ty = 3 - 6 * p;
      return `scale(1.08) translateY(${ty.toFixed(4)}%)`;
    }
    case "slow_cinematic": {
      const scale = 1.0 + 0.06 * p;
      const tx = -1.5 * p;
      return `scale(${scale.toFixed(4)}) translateX(${tx.toFixed(4)}%)`;
    }
    case "fast_impact": {
      // Fast scale burst at the start, then settle
      const scale = p < 0.12 ? 1.2 - (0.2 * p) / 0.12 : 1.0;
      return `scale(${scale.toFixed(4)})`;
    }
    case "static":
    default:
      return "scale(1)";
  }
}

/** Extra transform applied only near a segment's start, for transitions that want more than a plain opacity crossfade. */
function buildTransitionBurstTransform(transition: VisualSegmentProp["transition"], framesSinceStart: number): string {
  if (!transitionUsesTransformBurst(transition)) return "";
  const burstFrames = 10;
  if (framesSinceStart < 0 || framesSinceStart > burstFrames) return "";
  const p = framesSinceStart / burstFrames;
  if (transition === "zoom") {
    const scale = 1.15 - 0.15 * p;
    return ` scale(${scale.toFixed(4)})`;
  }
  // slide
  const tx = 8 - 8 * p;
  return ` translateX(${tx.toFixed(4)}%)`;
}

/** Shape decoration layer matching the template-based design from Phase 5 MVP — all coordinates are fractions of the real composition width/height, never fixed 1920x1080 pixels. */
function ShapeAccent({ accentColor, seed, width, height }: { accentColor: string; seed: string; width: number; height: number }) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return (
    <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity: 0.3, pointerEvents: "none" }}>
      <circle cx={width * (0.104 + ((h % 300) / 300) * 0.156)} cy={height * (0.185 + (((h >> 4) % 300) / 300) * 0.093)} r={width * 0.094} fill={accentColor} opacity={0.18} />
      <circle cx={width * (0.896 - ((h % 200) / 200) * 0.104)} cy={height * (0.815 - (((h >> 6) % 200) / 200) * 0.093)} r={width * 0.063} fill={accentColor} opacity={0.12} />
      <rect x={0} y={height * 0.833} width={width} height={height * 0.167} fill={accentColor} opacity={0.07} />
    </svg>
  );
}

interface VisualSegmentLayerProps {
  segment: VisualSegmentProp;
}

export function VisualSegmentLayer({ segment }: VisualSegmentLayerProps) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const currentSeconds = frame / fps;
  const segStartFrame = segment.startTime * fps;
  const segEndFrame = segment.endTime * fps;
  const segDurationFrames = Math.max(segEndFrame - segStartFrame, 1);
  const fadeFrames = transitionFadeFrames(segment.transition);

  // Crossfade envelope: fade in at start, fade out at end. A "cut" (fadeFrames = 0) is a hard boundary, not a blend.
  const opacity = interpolate(
    frame,
    [
      segStartFrame,
      Math.min(segStartFrame + Math.max(fadeFrames, 1), (segStartFrame + segEndFrame) / 2),
      Math.max(segEndFrame - Math.max(fadeFrames, 1), (segStartFrame + segEndFrame) / 2),
      segEndFrame,
    ],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Skip render entirely when fully transparent (performance optimisation)
  if (opacity <= 0.001 && (currentSeconds < segment.startTime || currentSeconds >= segment.endTime)) {
    return null;
  }

  // Progress within this segment (0→1) for camera motion
  const segProgress = (frame - segStartFrame) / segDurationFrames;
  const motionTransform = buildMotionTransform(segment.cameraMotion, segProgress) + buildTransitionBurstTransform(segment.transition, frame - segStartFrame);

  const hasContent = segment.contentType !== "none";
  // Show content overlay only in the middle portion of the segment
  const contentVisible = segProgress >= 0.2 && segProgress <= 0.9;

  const isMedia = segment.mediaKind !== "color" && Boolean(segment.mediaUrl);
  const wrapperStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    background: buildBackground(segment),
    transform: motionTransform,
    transformOrigin: "center center",
    overflow: "hidden",
  };
  const mediaStyle: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover" };

  return (
    <AbsoluteFill style={{ opacity }}>
      {/* Background/media with camera motion */}
      <div style={wrapperStyle}>
        {isMedia ? (
          segment.mediaKind === "video" ? (
            <OffthreadVideo src={segment.mediaUrl!} muted startFrom={Math.round(segStartFrame)} style={mediaStyle} />
          ) : (
            <Img src={segment.mediaUrl!} style={mediaStyle} />
          )
        ) : (
          <ShapeAccent accentColor={segment.accentColor} seed={segment.id} width={width} height={height} />
        )}
      </div>

      {/* Real footage varies wildly in brightness — a fixed bottom scrim keeps captions legible without dimming procedural backgrounds, which are already palette-tuned for contrast. */}
      {isMedia && (
        <AbsoluteFill
          style={{
            background: "linear-gradient(to bottom, rgba(0,0,0,0) 60%, rgba(0,0,0,0.55) 100%)",
            pointerEvents: "none",
          }}
        />
      )}

      {/* Content overlay (statistic, text card, quote) */}
      {hasContent && contentVisible && (
        <ContentOverlay
          contentType={segment.contentType}
          contentValue={segment.contentValue}
          contentLabel={segment.contentLabel}
          accentColor={segment.accentColor}
          segmentProgress={segProgress}
        />
      )}
    </AbsoluteFill>
  );
}

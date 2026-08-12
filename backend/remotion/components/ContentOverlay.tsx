/**
 * ContentOverlay — renders content on top of a visual segment background.
 *
 * Three overlay types:
 *   - statistic: Large number/percentage with a supporting label below
 *   - text_card: Key phrase in a pill/card with a semi-transparent backdrop
 *   - quote: Quote-style text with a left accent border
 *
 * All types entrance-animate (scale + opacity) over the first 12 frames
 * of the segment's visible window. Exit is handled by the parent
 * VisualSegmentLayer's opacity envelope.
 */

import { AbsoluteFill, useVideoConfig } from "remotion";
import { getHorizontalMarginPx } from "../layout/safeZones";

interface ContentOverlayProps {
  contentType: "none" | "text_card" | "statistic" | "quote";
  contentValue?: string;
  contentLabel?: string;
  accentColor: string;
  /**
   * The segment-local progress (0→1) at the time this overlay becomes
   * visible. Used to drive the entrance animation: starts at 0.2 so the
   * entrance happens within the overlay's visible window, not before it.
   */
  segmentProgress: number;
}

// Number of frames for the entrance animation
const ENTRANCE_FRAMES = 12;

/** Simulated "current frame within the overlay window" for entrance animation. */
function entranceProgress(segmentProgress: number, totalSegmentFrames: number): number {
  // The overlay becomes visible at segmentProgress 0.2 (see VisualSegmentLayer).
  // Map progress within [0.2, 0.35] to [0, 1] for the entrance.
  const ENTRANCE_END = 0.35;
  if (segmentProgress <= 0.2) return 0;
  if (segmentProgress >= ENTRANCE_END) return 1;
  return (segmentProgress - 0.2) / (ENTRANCE_END - 0.2);
}

export function ContentOverlay({
  contentType,
  contentValue,
  contentLabel,
  accentColor,
  segmentProgress,
}: ContentOverlayProps) {
  const { width, height } = useVideoConfig();
  const ep = entranceProgress(segmentProgress, 1); // 0→1 entrance
  const scale = 0.85 + 0.15 * ep;
  const opacity = ep;

  if (!contentValue) return null;

  const containerStyle: React.CSSProperties = {
    transform: `scale(${scale})`,
    opacity,
    transition: "none", // CSS transitions would conflict with Remotion's frame-by-frame
  };
  const horizontalMargin = getHorizontalMarginPx(width);

  if (contentType === "statistic") {
    return (
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ ...containerStyle, textAlign: "center" }}>
          <div
            style={{
              fontSize: width * 0.185,
              fontWeight: 900,
              color: accentColor,
              lineHeight: 1,
              textShadow: `0 0 60px ${accentColor}66, 0 8px 32px rgba(0,0,0,0.6)`,
              letterSpacing: "-0.02em",
            }}
          >
            {contentValue}
          </div>
          {contentLabel && (
            <div
              style={{
                fontSize: width * 0.0408,
                fontWeight: 600,
                color: "rgba(255,255,255,0.85)",
                marginTop: height * 0.008,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              {contentLabel}
            </div>
          )}
        </div>
      </AbsoluteFill>
    );
  }

  if (contentType === "text_card") {
    return (
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div
          style={{
            ...containerStyle,
            background: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(8px)",
            borderRadius: width * 0.0125,
            border: `${width * 0.0016}px solid ${accentColor}55`,
            padding: `${height * 0.021}px ${width * 0.059}px`,
            maxWidth: "80%",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: width * 0.063,
              fontWeight: 800,
              color: "#ffffff",
              letterSpacing: "0.05em",
              lineHeight: 1.2,
              textShadow: "0 4px 16px rgba(0,0,0,0.4)",
            }}
          >
            {contentValue}
          </div>
        </div>
      </AbsoluteFill>
    );
  }

  if (contentType === "quote") {
    return (
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "flex-start", padding: `0 ${horizontalMargin}px` }}>
        <div
          style={{
            ...containerStyle,
            borderLeft: `${width * 0.0074}px solid ${accentColor}`,
            paddingLeft: width * 0.044,
            maxWidth: "80%",
          }}
        >
          <div
            style={{
              fontSize: width * 0.0556,
              fontWeight: 500,
              fontStyle: "italic",
              color: "rgba(255,255,255,0.92)",
              lineHeight: 1.35,
              textShadow: "0 4px 20px rgba(0,0,0,0.4)",
            }}
          >
            "{contentValue}"
          </div>
        </div>
      </AbsoluteFill>
    );
  }

  return null;
}

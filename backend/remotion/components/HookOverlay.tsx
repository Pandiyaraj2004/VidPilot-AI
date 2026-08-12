/**
 * HookOverlay — special large-text treatment for the opening (hook) scene.
 *
 * Shorts-upgrade: confined to the title safe band (safeZones.ts) instead of
 * centering on the whole screen — this is what keeps it from ever
 * overlapping DynamicCaption's bottom-anchored subtitle region, which owns
 * its own separate band. Font size scales with the real composition width
 * (useVideoConfig) instead of a fixed 1920px-tuned pixel value.
 *
 * Only rendered when sceneRole === "hook". For all other scenes, this
 * component returns null immediately.
 *
 * Animation:
 *   - Words stagger in, spaced by a real per-scene reveal pace (Phase 7's
 *     getCaptionPacing — emotion/energy/sceneRole-driven, not a fixed
 *     4-frame gap every time) — so the hook doesn't animate identically
 *     on every single video regardless of its actual content/mood.
 *   - Each word scales from 0.7 → 1.0 and fades from 0 → 1
 *   - The accent underline fades in after all words are visible
 */

import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { getHorizontalMarginPx, getTitleBand } from "../layout/safeZones";
import { getCaptionPacing } from "../layout/captionPacing";

interface HookOverlayProps {
  onScreenText: string;
  accentColor: string;
  fontFamily: string;
  sceneRole: string | null;
  emotion: string | null;
  energy: number;
}

export function HookOverlay({ onScreenText, accentColor, fontFamily, sceneRole, emotion, energy }: HookOverlayProps) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  // Only render on hook scenes
  if (sceneRole !== "hook") return null;
  if (!onScreenText.trim()) return null;

  const words = onScreenText.trim().split(/\s+/);
  const pacing = getCaptionPacing(emotion, energy, sceneRole);
  const WORD_STAGGER_FRAMES = pacing.revealFrames;
  const baseFontSizePx = width * (energy >= 0.7 ? 0.088 : 0.074);

  const titleBand = getTitleBand(height);
  const horizontalMargin = getHorizontalMarginPx(width);

  // Accent underline fades in after all words are visible
  const underlineStart = words.length * WORD_STAGGER_FRAMES + 10;
  const underlineOpacity = interpolate(frame, [underlineStart, underlineStart + 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: titleBand.top,
          height: titleBand.height,
          left: horizontalMargin,
          right: horizontalMargin,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ textAlign: "center", fontFamily }}>
          {/* Staggered word entrance */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: `0 ${width * 0.017}px`,
              lineHeight: 1.25,
            }}
          >
            {words.map((word, i) => {
              const wordStart = i * WORD_STAGGER_FRAMES;
              const opacity = interpolate(frame, [wordStart, wordStart + 8], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              const scale = interpolate(frame, [wordStart, wordStart + 8], [0.7, 1.0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              const translateY = interpolate(frame, [wordStart, wordStart + 8], [20, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              return (
                <span
                  key={i}
                  style={{
                    display: "inline-block",
                    fontSize: baseFontSizePx,
                    fontWeight: 900,
                    color: "#ffffff",
                    textShadow: "0 6px 30px rgba(0,0,0,0.6)",
                    letterSpacing: "-0.01em",
                    opacity,
                    transform: `scale(${scale}) translateY(${translateY}px)`,
                  }}
                >
                  {word}
                </span>
              );
            })}
          </div>

          {/* Accent underline */}
          <div
            style={{
              marginTop: height * 0.0125,
              height: height * 0.003,
              width: "40%",
              background: accentColor,
              borderRadius: height * 0.0015,
              margin: `${height * 0.0125}px auto 0`,
              opacity: underlineOpacity,
              boxShadow: `0 0 24px ${accentColor}88`,
            }}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
}

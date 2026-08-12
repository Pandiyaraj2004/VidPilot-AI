/**
 * DynamicCaption — real, safe-zone-anchored narration captions with
 * word-by-word kinetic reveal and scale-pop emphasis (Phase 7 completion).
 *
 * Box geometry is untouched from the prior static-block version: font
 * size, line wrapping, and box height are still computed from genuine
 * Chrome text measurement (subtitleLayout.ts) against the real
 * composition width/height, and the box still grows upward from the fixed
 * safe bottom line (safeZones.ts). Only what happens *inside* that
 * already-correctly-sized, already-safe-zoned box is new: each word fades
 * and scales in individually, timed from computeWordTimings' deterministic
 * per-word approximation of the cue's real (measured-audio-derived)
 * [startSeconds, endSeconds] window — not a fixed "1 word = N seconds"
 * rule, and not claimed to be real forced-alignment timing.
 *
 * Reveal speed and whether an emphasized word pops (and how much) come
 * from getCaptionPacing(emotion, energy, sceneRole) — the same signals
 * (and the same energy-tier thresholds) the Phase 5 visual motion/
 * transition systems already use, so a Motivation scene's captions build
 * fast with a strong pop while a Mystery scene's build slowly and stay
 * restrained, without inventing a parallel category system.
 *
 * Caption "style" (normal/emphasis/reveal/question) still changes the
 * preferred font size and background treatment — it still doesn't change
 * *position*. Every caption lives in the same bottom safe region; the
 * hook/title headline has its own region entirely (HookOverlay.tsx), so
 * the two layers never compete for the same screen space.
 */

import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { getHorizontalSafeWidth, getSubtitleMaxHeight, getSubtitleSafeBottom } from "../layout/safeZones";
import { fitSubtitleLayout } from "../layout/subtitleLayout";
import { computeWordTimings, type WordTiming } from "../layout/wordTiming";
import { getCaptionPacing, type CaptionPacing } from "../layout/captionPacing";
import { selectFallbackHighlightWords } from "../layout/emphasisFallback";

export interface SubtitleCueProp {
  index: number;
  text: string;
  startSeconds: number;
  endSeconds: number;
}

interface DynamicCaptionProps {
  subtitles: SubtitleCueProp[];
  highlightWords: string[] | null;
  captionStyle: string | null;
  accentColor: string;
  fontFamily: string;
  /** True when the scene is the hook (first) scene — HookOverlay owns the headline there, so captions always use the plain bottom-bar treatment regardless of captionStyle. */
  isHookScene: boolean;
  /** Drive caption reveal pacing (getCaptionPacing) the same way these already drive visual motion/transitions. All may be absent on older jobs — pacing degrades gracefully to its medium-energy default. */
  emotion: string | null;
  energy: number | null;
  sceneRole: string | null;
}

// --- Highlight matching ---

function normalise(word: string): string {
  return word.toLowerCase().replace(/[^a-z0-9%$£€.]/g, "");
}

function isHighlighted(word: string, highlights: string[]): boolean {
  const wn = normalise(word);
  if (!wn) return false;
  return highlights.some((h) => {
    const hn = normalise(h);
    return hn.length > 0 && (wn === hn || wn.includes(hn) || hn.includes(wn));
  });
}

/**
 * Renders one wrapped line, word by word, each fading/scaling in at its
 * own real (approximated) reveal time. `wordTimings` is this line's slice
 * of the cue's full per-word timing array — the caller hands each line
 * exactly the words it contains, in order, so index `i` here always lines
 * up with `wordTimings[i]` regardless of where the line broke.
 *
 * Whitespace spans still get an explicit `fontSize` (not left to inherit
 * the browser default) and word spans still use `display: inline` rather
 * than `inline-block` — both are the fix for a real word-spacing collapse
 * bug found via inspecting an actual rendered frame; removing either
 * reintroduces it.
 */
const EMOJI_MAP: Record<string, string> = {
  time: "⏱️",
  gravity: "🌌",
  space: "🚀",
  star: "⭐",
  starry: "⭐",
  planet: "🪐",
  earth: "🌍",
  sun: "☀️",
  black: "🕳️",
  hole: "🕳️",
  science: "🧪",
  dna: "🧬",
  brain: "🧠",
  mind: "🧠",
  success: "🏆",
  dream: "💭",
  win: "🏅",
  gold: "🥇",
  money: "💵",
  cash: "💰",
  rich: "🤑",
  computer: "💻",
  robot: "🤖",
  ai: "🤖",
  data: "📊",
  fire: "🔥",
  hot: "🔥",
  light: "💡",
  idea: "💡",
  love: "❤️",
  heart: "❤️",
  water: "💧",
  ocean: "🌊",
  sea: "🌊",
  world: "🗺️",
  alert: "🚨",
  warn: "⚠️",
  danger: "⚠️",
};

function HighlightedLine({
  text,
  highlights,
  accentColor,
  baseFontSize,
  baseColor,
  wordTimings,
  pacing,
  frame,
  fps,
}: {
  text: string;
  highlights: string[];
  accentColor: string;
  baseFontSize: number;
  baseColor: string;
  wordTimings: WordTiming[];
  pacing: CaptionPacing;
  frame: number;
  fps: number;
}) {
  const tokens = text.split(/(\s+)/);
  let wordIndex = 0;

  return (
    <>
      {tokens.map((token, i) => {
        if (/^\s+$/.test(token)) return <span key={i} style={{ fontSize: baseFontSize }}>{token}</span>;

        const timing = wordTimings[wordIndex];
        wordIndex += 1;
        const highlight = highlights.length > 0 && isHighlighted(token, highlights);

        // Defensive fallback: treat a missing timing entry as already-revealed
        const revealStartFrame = timing ? timing.startSeconds * fps : 0;
        const revealEndFrame = revealStartFrame + pacing.revealFrames;

        const opacity = interpolate(frame, [revealStartFrame, revealEndFrame], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const translateY = interpolate(frame, [revealStartFrame, revealEndFrame], [8, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        // Emphasized words get a short scale-pop after their reveal finishes
        const scale =
          highlight && pacing.popEnabled
            ? interpolate(
                frame,
                [revealStartFrame, revealEndFrame, revealEndFrame + 6, revealEndFrame + 14],
                [0.85, 1.0, pacing.popPeakScale, 1.0],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
              )
            : interpolate(frame, [revealStartFrame, revealEndFrame], [0.85, 1.0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });

        const cleanToken = normalise(token);
        const emoji = highlight ? EMOJI_MAP[cleanToken] : null;

        return (
          <span
            key={i}
            style={{
              position: "relative",
              color: highlight ? accentColor : baseColor,
              fontWeight: highlight ? 800 : 600,
              fontSize: highlight ? baseFontSize * 1.15 : baseFontSize,
              display: "inline-block",
              textShadow: highlight
                ? `0 0 25px ${accentColor}88, 0 3px 12px rgba(0,0,0,0.6)`
                : "0 3px 10px rgba(0,0,0,0.4)",
              opacity,
              transform: `scale(${scale}) translateY(${translateY}px)`,
              transition: "transform 0.1s ease-out",
            }}
          >
            {emoji && (
              <span
                style={{
                  position: "absolute",
                  bottom: "105%",
                  left: "50%",
                  transform: "translateX(-50%) scale(1.2)",
                  fontSize: baseFontSize * 0.9,
                  lineHeight: 1,
                  pointerEvents: "none",
                }}
              >
                {emoji}
              </span>
            )}
            {token}
          </span>
        );
      })}
    </>
  );
}

// --- Caption style → preferred font size + background treatment (position is no longer per-style, see file header) ---

interface CaptionStyleConfig {
  /** Preferred font size as a fraction of composition width — scales correctly at any resolution/aspect ratio; subtitleLayout.ts shrinks it further only if the real measured text wouldn't fit. */
  preferredFontFraction: number;
  background: string;
  borderRadiusFraction: number;
}

function getCaptionStyleConfig(style: string | null, isHookScene: boolean): CaptionStyleConfig {
  const effectiveStyle = isHookScene ? "normal" : (style ?? "normal");
  switch (effectiveStyle) {
    case "emphasis":
      return { preferredFontFraction: 0.058, background: "rgba(0,0,0,0.68)", borderRadiusFraction: 0.015 };
    case "reveal":
      return { preferredFontFraction: 0.062, background: "rgba(0,0,0,0.72)", borderRadiusFraction: 0.015 };
    case "question":
      return { preferredFontFraction: 0.05, background: "rgba(0,0,0,0.62)", borderRadiusFraction: 0.013 };
    case "normal":
    default:
      return { preferredFontFraction: 0.052, background: "rgba(0,0,0,0.62)", borderRadiusFraction: 0.013 };
  }
}

export function DynamicCaption({
  subtitles,
  highlightWords,
  captionStyle,
  accentColor,
  fontFamily,
  isHookScene,
  emotion,
  energy,
  sceneRole,
}: DynamicCaptionProps) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const currentSeconds = frame / fps;

  const cue = subtitles.find(
    (c) => currentSeconds >= c.startSeconds && currentSeconds < c.endSeconds
  );

  // Real AI-provided emphasis words when present; otherwise a conservative,
  // clearly-labeled deterministic fallback (see emphasisFallback.ts) so a
  // scene the AI didn't tag still gets *a* pop rather than none at all —
  // never pretended to be AI-chosen.
  const highlights =
    highlightWords && highlightWords.length > 0
      ? highlightWords
      : selectFallbackHighlightWords(subtitles.map((s) => s.text));

  const pacing = getCaptionPacing(emotion, energy ?? undefined, sceneRole);

  if (!cue) return null;

  const cfg = getCaptionStyleConfig(captionStyle, isHookScene);

  const safeWidth = getHorizontalSafeWidth(width);
  const maxHeight = getSubtitleMaxHeight(height);
  const preferredFontSizePx = width * cfg.preferredFontFraction;
  const horizontalPaddingPx = preferredFontSizePx * 0.7;
  // The real caption text area is narrower than the safe width by the box's own horizontal padding.
  const layout = fitSubtitleLayout(cue.text, safeWidth - horizontalPaddingPx * 2, maxHeight, fontFamily, preferredFontSizePx);

  const safeBottom = getSubtitleSafeBottom(height);
  const boxTop = safeBottom - layout.boxHeightPx;

  // Entrance animation for the box itself (first 6 frames after the cue
  // starts) — a small, separate fade from the per-word reveal below; the
  // box's background scrim appears smoothly while its words reveal
  // progressively on top of it.
  const cueStartFrame = cue.startSeconds * fps;
  const entranceOpacity = interpolate(frame, [cueStartFrame, cueStartFrame + 6], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const wordTimings = computeWordTimings(cue.text, cue.startSeconds, cue.endSeconds);
  let wordCursor = 0;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          top: boxTop,
          left: "50%",
          transform: "translateX(-50%)",
          width: layout.boxWidthPx,
          maxWidth: safeWidth,
          background: cfg.background,
          borderRadius: height * cfg.borderRadiusFraction,
          padding: `${preferredFontSizePx * 0.4}px ${horizontalPaddingPx}px`,
          fontFamily,
          textAlign: "center",
          lineHeight: 1.35,
          opacity: entranceOpacity,
        }}
      >
        {layout.lines.map((line, i) => {
          const lineWordCount = line.split(/\s+/).filter(Boolean).length;
          const lineTimings = wordTimings.slice(wordCursor, wordCursor + lineWordCount);
          wordCursor += lineWordCount;
          return (
            <div key={i}>
              <HighlightedLine
                text={line}
                highlights={highlights}
                accentColor={accentColor}
                baseFontSize={layout.fontSizePx}
                baseColor="#ffffff"
                wordTimings={lineTimings}
                pacing={pacing}
                frame={frame}
                fps={fps}
              />
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

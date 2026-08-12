import { AbsoluteFill, Img } from "remotion";
// @ts-expect-error -- .ttf has no type declaration; webpack's asset/resource loader handles it.
import notoSansEnglishUrl from "../assets/fonts/english/NotoSans-Variable.ttf";
// @ts-expect-error -- .ttf has no type declaration; webpack's asset/resource loader handles it.
import notoSansHindiUrl from "../assets/fonts/hindi/NotoSansDevanagari-Variable.ttf";
// @ts-expect-error -- .ttf has no type declaration; webpack's asset/resource loader handles it.
import notoSansTamilUrl from "../assets/fonts/tamil/NotoSansTamil-Variable.ttf";

export interface ThumbnailCompositionProps {
  width: number;
  height: number;
  headline: string;
  language: string;
  colors: [string, string];
  accentColor: string;
  /** An http(s) URL to a real, already-extracted still frame/image — see thumbnailRenderer.ts. Null renders a plain procedural gradient, same fallback convention as the main video's own visual engine. */
  backgroundImageUrl: string | null;
}

export const defaultThumbnailProps: ThumbnailCompositionProps = {
  width: 1280,
  height: 720,
  headline: "VIDPILOT AI",
  language: "en",
  colors: ["#0f172a", "#1e40af"],
  accentColor: "#67e8f9",
  backgroundImageUrl: null,
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

/**
 * A single still frame (1280×720, YouTube's real thumbnail format) —
 * deliberately NOT the 9:16 video composition scaled down. Real safe
 * margins (~6% each side) keep the headline clear of YouTube's own
 * duration-badge/progress-bar overlay in the player UI.
 */
export function ThumbnailComposition(props: ThumbnailCompositionProps) {
  const [from, to] = props.colors;
  const marginX = props.width * 0.06;
  const marginBottom = props.height * 0.08;

  return (
    <AbsoluteFill style={{ fontFamily: fontFamilyFor(props.language) }}>
      <style>{FONT_FACE_CSS}</style>

      <AbsoluteFill style={{ background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)` }} />

      {props.backgroundImageUrl && (
        <Img
          src={props.backgroundImageUrl}
          style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute" }}
        />
      )}

      {/* Bottom-third scrim so the headline stays readable over any real photo/video frame. */}
      <AbsoluteFill
        style={{
          background: "linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.45) 45%, rgba(0,0,0,0) 75%)",
        }}
      />

      <AbsoluteFill
        style={{
          justifyContent: "flex-end",
          alignItems: "flex-start",
          paddingLeft: marginX,
          paddingRight: marginX,
          paddingBottom: marginBottom,
        }}
      >
        <div
          style={{
            display: "inline-block",
            borderLeft: `${props.width * 0.012}px solid ${props.accentColor}`,
            paddingLeft: props.width * 0.02,
          }}
        >
          <span
            style={{
              display: "block",
              fontSize: props.height * 0.14,
              lineHeight: 1.05,
              fontWeight: 800,
              color: "#ffffff",
              textShadow: "0 4px 18px rgba(0,0,0,0.65)",
              maxWidth: props.width * 0.86,
              wordBreak: "break-word",
            }}
          >
            {props.headline}
          </span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

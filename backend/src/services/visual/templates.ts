import type { VideoStyle, VisualTemplate } from "../../types/index.js";

/**
 * Which template family fits a given content style, and its fallback
 * alternate. Every non-cartoon style gets "facts" as its second candidate
 * so that template stays a genuine rotation (see pickTemplate) rather than
 * a fixed 1:1 mapping — two jobs with the same style can still render with
 * a different template. Cartoon is forced to its own template: it is a
 * structurally different render path (see visualStyleSetting handling in
 * localVisualProvider.ts), not a rotation candidate for the others.
 */
const STYLE_TEMPLATE_CANDIDATES: Record<VideoStyle, VisualTemplate[]> = {
  documentary: ["documentary", "facts"],
  story: ["documentary", "facts"],
  explainer: ["explainer", "facts"],
  qa: ["explainer", "facts"],
  list: ["listicle", "facts"],
  cartoon: ["cartoon"],
};

export function candidateTemplatesForStyle(style: VideoStyle): VisualTemplate[] {
  return STYLE_TEMPLATE_CANDIDATES[style];
}

export interface Palette {
  id: string;
  colors: [string, string];
  accent: string;
}

/** Hand-picked, non-AI-generated palettes. Each is a gradient pair plus one accent used for text/icons. */
export const PALETTES: Palette[] = [
  { id: "indigo-violet", colors: ["#312e81", "#7c3aed"], accent: "#facc15" },
  { id: "slate-cyan", colors: ["#0f172a", "#0891b2"], accent: "#5eead4" },
  { id: "emerald-teal", colors: ["#064e3b", "#0d9488"], accent: "#fef08a" },
  { id: "rose-orange", colors: ["#7f1d1d", "#ea580c"], accent: "#fef3c7" },
  { id: "blue-sky", colors: ["#1e3a8a", "#0284c7"], accent: "#fde047" },
  { id: "plum-fuchsia", colors: ["#4a044e", "#c026d3"], accent: "#a7f3d0" },
];

export const BACKGROUND_KINDS = ["gradient", "gradient", "solid", "pattern"] as const;

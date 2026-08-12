/**
 * Emotion-specific colour palettes for the Phase 5 dynamic visual engine.
 *
 * Each emotion gets 4 dark, richly coloured palettes so different scenes with
 * the same emotion still vary visually. Selection is deterministic —
 * hash(jobId + emotion) % palettes.length — so re-rendering the same job
 * always produces the same palette sequence.
 *
 * Palette design goals:
 *   - Dark backgrounds (never white/light) so text stays readable
 *   - Distinct accent colours for caption highlights and overlays
 *   - Palettes within an emotion share a "mood family" but differ enough to
 *     create visual interest across segments and scenes
 */

export interface EmotionPalette {
  colors: [string, string];
  accent: string;
}

/** All palettes for every supported emotion. Unknown emotions fall back to "informative". */
const EMOTION_PALETTES: Record<string, EmotionPalette[]> = {
  curiosity: [
    { colors: ["#1e1b4b", "#4338ca"], accent: "#a5f3fc" },
    { colors: ["#0f172a", "#1e40af"], accent: "#67e8f9" },
    { colors: ["#14103a", "#5b21b6"], accent: "#c4b5fd" },
    { colors: ["#0d1b3e", "#2563eb"], accent: "#93c5fd" },
  ],
  motivation: [
    { colors: ["#7c2d12", "#ea580c"], accent: "#fef08a" },
    { colors: ["#831843", "#e11d48"], accent: "#fda4af" },
    { colors: ["#713f12", "#d97706"], accent: "#fef3c7" },
    { colors: ["#450a0a", "#b91c1c"], accent: "#fca5a5" },
  ],
  mystery: [
    { colors: ["#0c0a09", "#1c1917"], accent: "#a78bfa" },
    { colors: ["#09090b", "#18181b"], accent: "#8b5cf6" },
    { colors: ["#030712", "#111827"], accent: "#6366f1" },
    { colors: ["#0a0a0f", "#1a1a2e"], accent: "#818cf8" },
  ],
  excitement: [
    { colors: ["#701a75", "#c026d3"], accent: "#f0abfc" },
    { colors: ["#4a044e", "#9333ea"], accent: "#e879f9" },
    { colors: ["#581c87", "#7c3aed"], accent: "#c4b5fd" },
    { colors: ["#86198f", "#d946ef"], accent: "#f5d0fe" },
  ],
  calm: [
    { colors: ["#0c4a6e", "#0369a1"], accent: "#bae6fd" },
    { colors: ["#064e3b", "#059669"], accent: "#a7f3d0" },
    { colors: ["#1e3a5f", "#2563eb"], accent: "#bfdbfe" },
    { colors: ["#134e4a", "#0d9488"], accent: "#99f6e4" },
  ],
  dramatic: [
    { colors: ["#450a0a", "#991b1b"], accent: "#fecaca" },
    { colors: ["#3b0764", "#6d28d9"], accent: "#ddd6fe" },
    { colors: ["#1c0a00", "#92400e"], accent: "#fde68a" },
    { colors: ["#1a0535", "#7e22ce"], accent: "#e9d5ff" },
  ],
  informative: [
    { colors: ["#0f172a", "#1e3a5f"], accent: "#7dd3fc" },
    { colors: ["#052e16", "#166534"], accent: "#86efac" },
    { colors: ["#1e1b4b", "#3730a3"], accent: "#a5b4fc" },
    { colors: ["#0d2137", "#0284c7"], accent: "#38bdf8" },
  ],
  surprise: [
    { colors: ["#713f12", "#d97706"], accent: "#fef08a" },
    { colors: ["#7f1d1d", "#b91c1c"], accent: "#fca5a5" },
    { colors: ["#064e3b", "#047857"], accent: "#6ee7b7" },
    { colors: ["#1e1b4b", "#4f46e5"], accent: "#f0abfc" },
  ],
  serious: [
    { colors: ["#0f172a", "#1e293b"], accent: "#94a3b8" },
    { colors: ["#1c1917", "#292524"], accent: "#a8a29e" },
    { colors: ["#111827", "#1f2937"], accent: "#9ca3af" },
    { colors: ["#0c0a09", "#1c1917"], accent: "#78716c" },
  ],
  humorous: [
    { colors: ["#854d0e", "#f59e0b"], accent: "#fef08a" },
    { colors: ["#701a75", "#c026d3"], accent: "#f5d0fe" },
    { colors: ["#1b5e20", "#2e7d32"], accent: "#a5d6a7" },
    { colors: ["#0d47a1", "#1565c0"], accent: "#f48fb1" },
  ],
};

const FALLBACK_EMOTION = "informative";

/** Deterministic but distribution-mixing hash — same input always yields same index. */
function hashString(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Returns a specific palette for the given emotion, varied by the seed so
 * different jobs/segments of the same emotion get different palettes.
 */
export function getPaletteForEmotion(emotion: string | undefined, seed: string): EmotionPalette {
  const key = emotion && EMOTION_PALETTES[emotion] ? emotion : FALLBACK_EMOTION;
  const palettes = EMOTION_PALETTES[key]!;
  return palettes[hashString(seed) % palettes.length];
}

/** Returns every supported emotion name. */
export function getSupportedEmotions(): string[] {
  return Object.keys(EMOTION_PALETTES);
}

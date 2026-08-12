import type { ContentCategory, VideoStyle, VisualStyle } from "../../types/index.js";
import { CONTENT_CATEGORY_LABELS } from "../audio/contentCategory.js";

export interface GenerationContext {
  topic: string;
  inputScript: string | null;
  style: VideoStyle;
  /** User-selected topic domain — a writing hint only; doesn't change the response schema. Also drives music-folder selection (services/audio/contentCategory.ts). */
  contentCategory: ContentCategory;
  durationSeconds: number;
  language: string;
  visualStyle: VisualStyle;
  /** Optional user instruction for a regeneration pass, e.g. "make the hook stronger". */
  instruction?: string;
  /** Recently generated videos to deliberately avoid repeating the angle/structure of. */
  avoidSimilarTo?: { title: string; hook: string }[];
}

const STYLE_GUIDANCE: Record<VideoStyle, string> = {
  documentary: "Structure: a strong hook, then factual progression building evidence, explanation of the subject, then a conclusion that ties it together.",
  explainer: "Structure: state the problem or question, explain it clearly, give one or two concrete examples, then conclude.",
  story: "Structure: a hook, a setup that establishes the situation, a conflict or turning point, development, and a resolution.",
  qa: "Structure: pose the central question directly, answer it, explain the reasoning, give a concrete example, then conclude.",
  list: "Structure: a hook, then a clear sequence of distinct facts or items (one per scene), then a short conclusion.",
  cartoon: "Structure like a story, but write every visualDescription so it can later be represented with a character, a background, and an action — describe what a character is doing and where, not just abstract imagery.",
};

const VISUAL_STYLE_GUIDANCE: Record<VisualStyle, string> = {
  automatic: "Choose whatever visual treatment best fits the topic.",
  minimal: "Keep visualDescription entries simple and clean — plain backgrounds, minimal on-screen elements.",
  cinematic: "Write visualDescription entries with a cinematic, dramatic quality — camera framing, mood, lighting.",
  educational: "Write visualDescription entries like an educational diagram or infographic — clear labeled visuals.",
  cartoon: "Write visualDescription entries around a cartoon character performing actions against a background.",
};

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  ta: "Tamil",
  hi: "Hindi",
};

const WORDS_PER_MINUTE = 140;

export function buildSystemPrompt(): string {
  return [
    "You are the content engine for VidPilot AI, a personal YouTube video production tool.",
    "Generate original, useful, engaging video content based on the given topic and settings.",
    "The output will later be converted into narration audio, visuals, on-screen subtitles, and rendered video scenes — so every scene needs narration, a visual description, and on-screen text that a separate rendering system can consume directly.",
    "Return ONLY the structured JSON described by the response schema. Do not include explanations, markdown formatting, or any text outside the JSON object.",
  ].join(" ");
}

export function buildUserPrompt(ctx: GenerationContext): string {
  const targetMinutes = ctx.durationSeconds / 60;
  const targetWords = Math.round(targetMinutes * WORDS_PER_MINUTE);
  const languageName = LANGUAGE_NAMES[ctx.language] ?? ctx.language;

  const lines: string[] = [];

  if (ctx.inputScript && ctx.inputScript.trim()) {
    lines.push(
      "The user has supplied their own script below. Do NOT replace it with unrelated content — analyze it and restructure it into the required scene format, preserving its meaning, facts, and intent as closely as possible.",
      "--- USER SCRIPT START ---",
      ctx.inputScript.trim(),
      "--- USER SCRIPT END ---"
    );
  } else {
    lines.push(`Topic: ${ctx.topic}`);
  }

  lines.push(
    `Content category: ${CONTENT_CATEGORY_LABELS[ctx.contentCategory]}. Write tone, pacing, and visualKeywords appropriate for this topic domain.`,
    `Video style: ${ctx.style}. ${STYLE_GUIDANCE[ctx.style]}`,
    `Visual style: ${ctx.visualStyle}. ${VISUAL_STYLE_GUIDANCE[ctx.visualStyle]}`,
    `Language: write the title, hook, introduction, all scene narration and on-screen text, conclusion, description, and tags entirely in ${languageName}.`,
    `Target total narration length: approximately ${targetWords} words across all scenes combined (about ${targetMinutes.toFixed(1)} minutes at ~${WORDS_PER_MINUTE} words/minute). This is a guide for scene count and pacing, not a hard requirement — set each scene's estimatedDuration in seconds based on its own narration length, and set the top-level estimatedDuration to the sum of all scene durations.`,
    "Give each scene a stable id (e.g. \"scene-1\"), a zero-based order, narration, a concrete visualDescription usable by an illustrator, and onScreenText (a short caption; use an empty string only if truly nothing should appear on screen).",
    [
      "For each scene, also include these optional visual-direction fields (they help the renderer produce dynamic, emotion-appropriate visuals):",
      "  emotion (string) — the dominant emotional tone of this scene. Use one of: curiosity, motivation, mystery, excitement, calm, dramatic, informative, surprise, serious, humorous.",
      "  energy (number 0.0–1.0) — pacing intensity. 0.0 = very slow/calm, 1.0 = very fast/intense. A hook scene is usually 0.7–0.9; a calm explanation is 0.3–0.5.",
      "  sceneRole (string) — the narrative function of this scene. Use one of: hook, question, clue, reveal, fact, build, action, conclusion, transition.",
      "  highlightWords (array of 1–5 strings) — the most important words or short phrases from this scene's narration that should be visually emphasised. Pick words like numbers, key concepts, or emotional triggers (e.g. [\"20%\", \"brain\", \"energy\"]).",
      "  musicMood (string) — the background music feel for this scene. Use one of: curious, energetic, mysterious, calm, dramatic, uplifting, serious. (The music engine uses this in a later phase.)",
      "  visualKeywords (array of 2-6 strings) — concrete, specific search phrases a stock video/photo site would actually have footage for, describing exactly what this scene's narration is about. Be specific, not generic: for narration about the Eiffel Tower being a temporary structure, prefer [\"Eiffel Tower historical photograph\", \"Eiffel Tower construction\", \"1889 Paris Eiffel Tower\"] over just [\"Eiffel Tower\"]. For narration about brain signals, prefer [\"human brain\", \"neurons firing\", \"neural network animation\", \"brain electrical activity\"] over [\"brain\"]. Every phrase must be something a viewer would recognize as visually representing this scene, not a generic mood shot.",
    ].join("\n")
  );

  if (ctx.instruction && ctx.instruction.trim()) {
    lines.push(`Additional instruction for this generation: ${ctx.instruction.trim()}`);
  }

  if (ctx.avoidSimilarTo && ctx.avoidSimilarTo.length > 0) {
    const recentList = ctx.avoidSimilarTo.map((item) => `- "${item.title}" (hook: "${item.hook}")`).join("\n");
    lines.push(
      "Avoid repeating the angle, structure, or wording of these recently generated videos — take a genuinely different angle on the topic:",
      recentList
    );
  }

  return lines.join("\n\n");
}

export function buildRepairPrompt(previousIssues: string[]): string {
  return [
    "Your previous response did not pass validation for the following reasons:",
    previousIssues.map((issue) => `- ${issue}`).join("\n"),
    "Return a corrected JSON object that fixes all of these issues, following the same schema and instructions as before.",
  ].join("\n\n");
}

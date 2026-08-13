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
  /** Recently generated videos to deliberately avoid repeating the angle, structure, hook, or visual style of. */
  avoidSimilarTo?: {
    title: string;
    hook: string;
    storyStructure?: string;
    hookType?: string;
    ctaPattern?: string;
    visualKeywords?: string[];
    musicMood?: string;
  }[];
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
    "You are an expert YouTube content director, researcher, scriptwriter, storyteller, voice director, cinematographer, motion designer, sound designer, and video editor for VidPilot AI.",
    "Your goal is to produce high-quality, original YouTube content that feels intentionally created by a human expert director — never like an automated template.",
    "CRITICAL GUIDELINES:",
    "1. HUMANIZED SIMPLE ENGLISH: Write natural, conversational narration that everyone can understand. Never use repetitive AI clichés like 'Did you know...', 'In today's video...', 'Let's dive in...', 'Here are 5 amazing facts...', 'But wait, there's more...', 'You won't believe...'.",
    "2. HUMAN EDITORIAL VALUE: Include at least one genuine editorial decision — a surprising observation, a vivid practical comparison, a simple explanation of a complex idea, a historical connection, or a counterintuitive detail.",
    "3. SCRIPT RHYTHM & VARIETY: Vary sentence lengths throughout (e.g. short impact line → longer explanatory sentence → natural fragment).",
    "4. STORY STRUCTURE VARIATION: Select ONE primary storytelling structure best suited for this topic (e.g., 'hook_reveal_conclusion', 'story_conflict_resolution', 'question_investigation', 'problem_causes_solution', 'timeline_turning_point', 'comparison_verdict', 'myth_truth', 'what_if_scenario', 'mystery_clues', 'three_stage_progression', 'before_change_after', 'claim_evidence_counterpoint', 'fast_list', 'slow_documentary', 'mini_case_study').",
    "5. DYNAMIC HOOK & CTA: Custom hook tailored specifically to this topic (unexpected fact, question, contradiction, story moment, visual mystery). Tailor CTA to match (ask a topic question, invite comments, or conclude naturally without a generic CTA).",
    "Return ONLY the structured JSON described by the response schema without extra markdown commentary.",
  ].join("\n");
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
    `Target total narration length: approximately ${targetWords} words across all scenes combined (about ${targetMinutes.toFixed(1)} minutes at ~${WORDS_PER_MINUTE} words/minute). Set each scene's estimatedDuration based on its narration, and top-level estimatedDuration to their sum.`,
    "Top-level Director Fields to set:",
    "  storyStructure (string) — the chosen narrative structure out of: hook_reveal, story_conflict, question_investigation, problem_solution, timeline, myth_truth, what_if, mystery_clues, before_after, claim_counterpoint, fast_list, slow_documentary, mini_case_study.",
    "  hookType (string) — category of opening hook: unexpected_fact, strong_question, contradiction, story_moment, visual_mystery, bold_claim.",
    "  ctaPattern (string) — pattern used for conclusion/CTA: topic_question, comment_invite, continuation, subscribe_reason, none.",
    "For each scene, include:",
    "  id, order, narration, visualDescription, onScreenText, estimatedDuration.",
    "  emotion (string) — curiosity | motivation | mystery | excitement | calm | dramatic | informative | surprise | serious | humorous.",
    "  energy (number 0.0–1.0) — pacing intensity.",
    "  sceneRole (string) — hook | question | clue | reveal | fact | build | action | conclusion | transition.",
    "  highlightWords (array of 1–5 strings) — key words to emphasize in captions.",
    "  musicMood (string) — curious | energetic | mysterious | calm | dramatic | uplifting | serious.",
    "  visualKeywords (array of 2–6 strings) — concrete, highly specific search terms (e.g. ['human brain synaptic impulse', 'neural connection animation'] instead of ['brain']).",
    "  cameraMovement (string) — camera framing/motion for visual renderer: static | push_in | pull_out | tracking | close_up | overhead | wide_shot.",
    "  editorialNote (string) — brief note explaining the human editorial choice or comparison in this scene."
  );

  if (ctx.instruction && ctx.instruction.trim()) {
    lines.push(`Additional instruction for this generation: ${ctx.instruction.trim()}`);
  }

  if (ctx.avoidSimilarTo && ctx.avoidSimilarTo.length > 0) {
    const recentList = ctx.avoidSimilarTo
      .map((item) => {
        const details = [
          `Title: "${item.title}"`,
          `Hook: "${item.hook}"`,
          item.storyStructure ? `Structure: ${item.storyStructure}` : null,
          item.hookType ? `HookType: ${item.hookType}` : null,
          item.ctaPattern ? `CTA: ${item.ctaPattern}` : null,
          item.musicMood ? `MusicMood: ${item.musicMood}` : null,
          item.visualKeywords && item.visualKeywords.length > 0 ? `Visuals: [${item.visualKeywords.join(", ")}]` : null,
        ]
          .filter(Boolean)
          .join(" | ");
        return `- ${details}`;
      })
      .join("\n");
    lines.push(
      "CROSS-VIDEO REPETITION GUARD:",
      "To keep channel content fresh, avoid repeating the structure, opening pattern, CTA pattern, pacing, or visual choices of these recent videos. Intentionally select DIFFERENT options:",
      recentList
    );
  }

  lines.push(
    "OUTPUT FORMAT: You must return a single JSON object strictly matching this template structure:",
    JSON.stringify({
      title: "String",
      hook: "String",
      introduction: "String",
      scenes: [
        {
          id: "1",
          order: 0,
          narration: "String",
          visualDescription: "String",
          onScreenText: "String",
          estimatedDuration: 10,
          transition: "cut",
          emotion: "curiosity",
          energy: 0.5,
          sceneRole: "fact",
          highlightWords: ["word"],
          musicMood: "curious",
          visualKeywords: ["keyword"],
          cameraMovement: "static",
          editorialNote: "note"
        }
      ],
      conclusion: "String",
      description: "String",
      tags: ["tag"],
      estimatedDuration: 35,
      storyStructure: "story_conflict",
      hookType: "strong_question",
      ctaPattern: "topic_question"
    }, null, 2)
  );

  return lines.join("\n\n");
}

export function buildRepairPrompt(previousIssues: string[]): string {
  return [
    "Your previous response did not pass validation for the following reasons:",
    previousIssues.map((issue) => `- ${issue}`).join("\n"),
    "Return a corrected JSON object that fixes all of these issues, following the same schema and instructions as before.",
  ].join("\n\n");
}

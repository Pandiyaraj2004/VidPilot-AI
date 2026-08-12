import { z } from "zod";

/**
 * Runtime validation for AI provider output. Structurally mirrors
 * VideoContent/VideoScene in types/index.ts — kept in sync by hand since
 * this is the one place raw, untrusted AI JSON gets checked before it's
 * allowed to become application data (see validators.ts for the schema
 * plus job.ts's business-rule checks that go beyond shape).
 */
export const VideoSceneSchema = z.object({
  id: z.string().min(1),
  order: z.number().int().min(0),
  narration: z.string().min(1),
  visualDescription: z.string().min(1),
  onScreenText: z.string(),
  estimatedDuration: z.number().positive(),
  transition: z.string().optional(),
  // Phase 5 — optional scene-level metadata produced by the AI
  emotion: z.string().optional(),
  energy: z.number().min(0).max(1).optional(),
  sceneRole: z.string().optional(),
  highlightWords: z.array(z.string()).max(10).optional(),
  musicMood: z.string().optional(),
  // Phase 5 upgrade — concrete visual search phrases for the internet asset providers
  visualKeywords: z.array(z.string()).max(6).optional(),
});

export const VideoContentSchema = z.object({
  title: z.string().min(1),
  hook: z.string().min(1),
  introduction: z.string().min(1),
  scenes: z.array(VideoSceneSchema).min(1),
  conclusion: z.string().min(1),
  description: z.string().min(1),
  tags: z.array(z.string().min(1)).min(1),
  estimatedDuration: z.number().positive(),
});

export type VideoContentParsed = z.infer<typeof VideoContentSchema>;

export interface ParseResult {
  ok: boolean;
  value?: VideoContentParsed;
  errors: string[];
}

/**
 * Parses raw AI text as JSON and validates its shape. Never throws —
 * callers use `.ok` to decide whether to retry/repair rather than crashing
 * on malformed or partial AI output.
 */
export function parseAndValidateContent(rawText: string): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(stripCodeFence(rawText));
  } catch {
    return { ok: false, errors: ["The AI response was not valid JSON."] };
  }

  const result = VideoContentSchema.safeParse(json);
  if (!result.success) {
    const errors = result.error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`);
    return { ok: false, errors };
  }

  return { ok: true, value: result.data, errors: [] };
}

// Some models wrap JSON in ```json fences even when asked not to — strip defensively
// rather than fail outright, since this is a purely cosmetic wrapper, not bad data.
function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1] : trimmed;
}

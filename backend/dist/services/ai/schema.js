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
    // Human Director criteria additions
    cameraMovement: z.string().optional(),
    editorialNote: z.string().optional(),
});
export const VideoContentSchema = z.object({
    title: z.string().min(1),
    hook: z.string().min(1),
    introduction: z.string().min(1),
    scenes: z.array(VideoSceneSchema).min(1),
    conclusion: z.string().trim().min(1),
    description: z.string().min(1),
    tags: z.array(z.string().min(1)).min(1),
    estimatedDuration: z.number().positive(),
    // Human Director criteria additions
    storyStructure: z.string().optional(),
    hookType: z.string().optional(),
    ctaPattern: z.string().optional(),
});
/**
 * Parses raw AI text as JSON and validates its shape. Never throws —
 * callers use `.ok` to decide whether to retry/repair rather than crashing
 * on malformed or partial AI output.
 */
export function parseAndValidateContent(rawText) {
    let json;
    try {
        json = JSON.parse(stripCodeFence(rawText));
    }
    catch {
        return { ok: false, errors: ["The AI response was not valid JSON."] };
    }
    // Normalize only lossless IDs and a duration derived from valid scene durations.
    // Never synthesize missing narration, conclusions, facts, or scenes.
    if (json && typeof json === "object" && "scenes" in json && Array.isArray(json.scenes)) {
        for (const scene of json.scenes)
            if (scene && typeof scene.id === "number" && Number.isSafeInteger(scene.id))
                scene.id = String(scene.id);
        if (!("estimatedDuration" in json) && json.scenes.length && json.scenes.every(s => typeof s.estimatedDuration === "number" && Number.isFinite(s.estimatedDuration) && s.estimatedDuration > 0))
            Object.assign(json, { estimatedDuration: json.scenes.reduce((sum, s) => sum + s.estimatedDuration, 0) });
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
function stripCodeFence(text) {
    const trimmed = text.trim();
    const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    return fenced ? fenced[1] : trimmed;
}

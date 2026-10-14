import { simpleEnglishIssues } from "./english.js";
import { GeminiProvider } from "./geminiProvider.js";
import { OpenRouterProvider } from "./openRouterProvider.js";
import { buildRepairPrompt, buildSystemPrompt, buildUserPrompt } from "./prompts.js";
import { parseAndValidateContent } from "./schema.js";
import { validateContentQuality } from "./validators.js";
import { ProviderError } from "./aiProvider.js";
export class AIGenerationError extends Error {
    constructor(message) {
        super(message);
        this.name = "AIGenerationError";
    }
}
const ATTEMPTS_PER_PROVIDER = 2;
/**
 * The content engine — the ONLY thing the rest of the app calls to get a
 * VideoContent. It owns provider selection, prompt construction, the
 * fallback ladder, parsing, and validation. Callers never see Gemini or
 * OpenRouter directly (contract: generateVideoContent(ctx), never
 * "callGemini()" from job/UI code).
 */
export async function generateVideoContent(ctx, providers = [new GeminiProvider(), new OpenRouterProvider()]) {
    let lastErrorMessage = "AI generation failed for an unknown reason.";
    let repairIssues = null;
    for (let providerIndex = 0; providerIndex < providers.length; providerIndex++) {
        const provider = providers[providerIndex];
        for (let attempt = 0; attempt < ATTEMPTS_PER_PROVIDER; attempt++) {
            const userPrompt = repairIssues
                ? `${buildUserPrompt(ctx)}\n\n${buildRepairPrompt(repairIssues)}`
                : buildUserPrompt(ctx);
            try {
                const raw = await provider.generate({ systemPrompt: buildSystemPrompt(), userPrompt });
                const parsed = parseAndValidateContent(raw.rawText);
                if (!parsed.ok || !parsed.value) {
                    lastErrorMessage = `${provider.name}: ${parsed.errors.join("; ")}`;
                    repairIssues = parsed.errors;
                    continue;
                }
                const qualityErrors = [...validateContentQuality(parsed.value, ctx.durationSeconds), ...simpleEnglishIssues(parsed.value.scenes.map(s => s.narration).join(" "), ctx.language)];
                if (ctx.targetNarrationWords) {
                    const words = parsed.value.scenes.reduce((n, s) => n + s.narration.trim().split(/\s+/).length, 0);
                    if (Math.abs(words - ctx.targetNarrationWords) > Math.max(5, ctx.targetNarrationWords * .08))
                        qualityErrors.push(`Measured-voice word budget requires approximately ${ctx.targetNarrationWords} spoken words; received ${words}. Expand or shorten explanations while preserving facts and all required scenes.`);
                }
                if (qualityErrors.length > 0) {
                    lastErrorMessage = `${provider.name}: ${qualityErrors.join("; ")}`;
                    repairIssues = qualityErrors;
                    continue;
                }
                return {
                    provider: provider.name,
                    content: parsed.value,
                    generatedAt: new Date().toISOString(),
                    model: raw.model,
                };
            }
            catch (err) {
                repairIssues = null;
                if (err instanceof ProviderError) {
                    lastErrorMessage = `${provider.name} (${err.kind}): ${err.message}`;
                    // Auth errors won't fix themselves on a second attempt with the same
                    // provider — move straight to the fallback instead of wasting a retry.
                    if (err.kind === "auth")
                        break;
                }
                else {
                    lastErrorMessage = `${provider.name}: ${err.message}`;
                }
            }
        }
    }
    throw new AIGenerationError(lastErrorMessage);
}

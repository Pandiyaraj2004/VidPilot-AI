import { RESPONSE_SCHEMA } from "./geminiProvider.js";
import { config, isConfigured } from "../../config/env.js";
import { classifyHttpStatus, fetchWithTimeout, ProviderError, safeReadErrorMessage, } from "./aiProvider.js";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
export const isFreeOpenRouterModel = (model) => model === "openrouter/free" || model.endsWith(":free");
export class OpenRouterProvider {
    name = "openrouter";
    async generate(request) {
        if (!isConfigured(config.ai.openRouterApiKey)) {
            throw new ProviderError("openrouter", "auth", "OpenRouter is not configured (missing OPENROUTER_API_KEY).");
        }
        const model = config.ai.openRouterModel;
        if (!isFreeOpenRouterModel(model))
            throw new ProviderError("openrouter", "auth", "Paid OpenRouter models are disabled. Use openrouter/free or a :free model to preserve the zero-cost requirement.");
        const body = {
            model,
            messages: [
                { role: "system", content: request.systemPrompt },
                { role: "user", content: request.userPrompt },
            ],
            response_format: { type: "json_schema", json_schema: { name: "video_content", strict: true, schema: jsonSchema(RESPONSE_SCHEMA) } },
            temperature: 0.6,
        };
        let response;
        try {
            response = await fetchWithTimeout(OPENROUTER_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${config.ai.openRouterApiKey}`,
                    "HTTP-Referer": "https://vidpilot.local",
                    "X-Title": "VidPilot AI",
                },
                body: JSON.stringify(body),
            }, config.ai.requestTimeoutMs, "openrouter");
        }
        catch (err) {
            if (err instanceof ProviderError)
                throw err;
            throw new ProviderError("openrouter", "unavailable", `OpenRouter request failed: ${err.message}`);
        }
        if (!response.ok) {
            const kind = classifyHttpStatus(response.status);
            const detail = await safeReadErrorMessage(response);
            throw new ProviderError("openrouter", kind, `OpenRouter returned HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
        }
        const data = (await response.json());
        const text = data.choices?.[0]?.message?.content;
        if (!text) {
            throw new ProviderError("openrouter", "invalid_response", "OpenRouter returned an empty response.");
        }
        return { rawText: text, model: data.model ?? model };
    }
}
function jsonSchema(value) {
    if (Array.isArray(value))
        return value.map(jsonSchema);
    if (!value || typeof value !== "object")
        return value;
    const obj = value;
    const result = {};
    for (const [key, v] of Object.entries(obj))
        result[key] = key === "type" ? String(v).toLowerCase() : jsonSchema(v);
    if (result.type === "object") {
        result.additionalProperties = false;
        result.required = Object.keys(obj.properties);
    }
    return result;
}

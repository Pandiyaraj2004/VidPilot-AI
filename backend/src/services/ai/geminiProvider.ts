import { config, isConfigured } from "../../config/env.js";
import {
  classifyHttpStatus,
  fetchWithTimeout,
  ProviderError,
  safeReadErrorMessage,
  type AIProvider,
  type ProviderGenerateRequest,
  type ProviderGenerateResult,
} from "./aiProvider.js";

// Gemini's structured-output schema uses an OpenAPI-3.0-like subset, not full JSON Schema
// (uppercase type names, no $ref/oneOf/etc). This constrains the model to our exact shape,
// which is far more reliable than asking nicely in the prompt — see aiProvider.ts docs.
const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    hook: { type: "STRING" },
    introduction: { type: "STRING" },
    scenes: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING" },
          order: { type: "INTEGER" },
          narration: { type: "STRING" },
          visualDescription: { type: "STRING" },
          onScreenText: { type: "STRING" },
          estimatedDuration: { type: "NUMBER" },
          transition: { type: "STRING" },
          emotion: { type: "STRING" },
          energy: { type: "NUMBER" },
          sceneRole: { type: "STRING" },
          highlightWords: { type: "ARRAY", items: { type: "STRING" } },
          musicMood: { type: "STRING" },
          visualKeywords: { type: "ARRAY", items: { type: "STRING" } },
        },
        required: ["id", "order", "narration", "visualDescription", "onScreenText", "estimatedDuration"],
      },
    },
    conclusion: { type: "STRING" },
    description: { type: "STRING" },
    tags: { type: "ARRAY", items: { type: "STRING" } },
    estimatedDuration: { type: "NUMBER" },
  },
  required: ["title", "hook", "introduction", "scenes", "conclusion", "description", "tags", "estimatedDuration"],
};

export class GeminiProvider implements AIProvider {
  readonly name = "gemini" as const;

  async generate(request: ProviderGenerateRequest): Promise<ProviderGenerateResult> {
    if (!isConfigured(config.ai.geminiApiKey)) {
      throw new ProviderError("gemini", "auth", "Gemini is not configured (missing GEMINI_API_KEY).");
    }

    const model = config.ai.geminiModel;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.ai.geminiApiKey}`;

    const body = {
      contents: [{ role: "user", parts: [{ text: request.userPrompt }] }],
      systemInstruction: { parts: [{ text: request.systemPrompt }] },
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.9,
        maxOutputTokens: 8192,
      },
    };

    let response: Response;
    try {
      response = await fetchWithTimeout(
        url,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
        config.ai.requestTimeoutMs,
        "gemini"
      );
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      throw new ProviderError("gemini", "unavailable", `Gemini request failed: ${(err as Error).message}`);
    }

    if (!response.ok) {
      const kind = classifyHttpStatus(response.status);
      const detail = await safeReadErrorMessage(response);
      throw new ProviderError("gemini", kind, `Gemini returned HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
    }

    const data = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
      promptFeedback?: { blockReason?: string };
    };

    if (data.promptFeedback?.blockReason) {
      throw new ProviderError("gemini", "invalid_response", `Gemini blocked the prompt: ${data.promptFeedback.blockReason}`);
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new ProviderError("gemini", "invalid_response", "Gemini returned an empty response.");
    }

    return { rawText: text, model };
  }
}

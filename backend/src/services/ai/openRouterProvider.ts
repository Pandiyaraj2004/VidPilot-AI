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

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export class OpenRouterProvider implements AIProvider {
  readonly name = "openrouter" as const;

  async generate(request: ProviderGenerateRequest): Promise<ProviderGenerateResult> {
    if (!isConfigured(config.ai.openRouterApiKey)) {
      throw new ProviderError("openrouter", "auth", "OpenRouter is not configured (missing OPENROUTER_API_KEY).");
    }

    const model = config.ai.openRouterModel;

    const body = {
      model,
      messages: [
        { role: "system", content: request.systemPrompt },
        { role: "user", content: request.userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.9,
    };

    let response: Response;
    try {
      response = await fetchWithTimeout(
        OPENROUTER_URL,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.ai.openRouterApiKey}`,
            "HTTP-Referer": "https://vidpilot.local",
            "X-Title": "VidPilot AI",
          },
          body: JSON.stringify(body),
        },
        config.ai.requestTimeoutMs,
        "openrouter"
      );
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      throw new ProviderError("openrouter", "unavailable", `OpenRouter request failed: ${(err as Error).message}`);
    }

    if (!response.ok) {
      const kind = classifyHttpStatus(response.status);
      const detail = await safeReadErrorMessage(response);
      throw new ProviderError(
        "openrouter",
        kind,
        `OpenRouter returned HTTP ${response.status}${detail ? `: ${detail}` : ""}`
      );
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
      model?: string;
    };

    const text = data.choices?.[0]?.message?.content;
    if (!text) {
      throw new ProviderError("openrouter", "invalid_response", "OpenRouter returned an empty response.");
    }

    return { rawText: text, model: data.model ?? model };
  }
}

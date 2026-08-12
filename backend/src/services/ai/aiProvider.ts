import type { AIProviderName } from "../../types/index.js";

export interface ProviderGenerateRequest {
  systemPrompt: string;
  userPrompt: string;
}

export interface ProviderGenerateResult {
  /** Raw text from the model — expected to be a JSON string, but not yet parsed or validated. */
  rawText: string;
  model: string;
}

export interface AIProvider {
  readonly name: AIProviderName;
  generate(request: ProviderGenerateRequest): Promise<ProviderGenerateResult>;
}

export type ProviderFailureKind = "auth" | "rate_limited" | "timeout" | "unavailable" | "invalid_response" | "unknown";

/** Thrown by provider implementations — the message is safe to log, never contains the API key. */
export class ProviderError extends Error {
  readonly provider: AIProviderName;
  readonly kind: ProviderFailureKind;

  constructor(provider: AIProviderName, kind: ProviderFailureKind, message: string) {
    super(message);
    this.name = "ProviderError";
    this.provider = provider;
    this.kind = kind;
  }
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  provider: AIProviderName
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new ProviderError(provider, "timeout", `${provider} request timed out after ${timeoutMs}ms.`);
    }
    throw new ProviderError(provider, "unavailable", `${provider} request failed: ${(err as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
}

export function classifyHttpStatus(status: number): ProviderFailureKind {
  if (status === 401 || status === 403) return "auth";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "unavailable";
  return "invalid_response";
}

/** Best-effort extraction of a short human-readable message from a provider's error body. */
export async function safeReadErrorMessage(response: Response): Promise<string | null> {
  try {
    const body = (await response.json()) as { error?: { message?: string } | string };
    if (typeof body?.error === "string") return body.error.slice(0, 300);
    return body?.error?.message?.slice(0, 300) ?? null;
  } catch {
    return null;
  }
}

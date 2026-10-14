/** Thrown by provider implementations — the message is safe to log, never contains the API key. */
export class ProviderError extends Error {
    provider;
    kind;
    constructor(provider, kind, message) {
        super(message);
        this.name = "ProviderError";
        this.provider = provider;
        this.kind = kind;
    }
}
export async function fetchWithTimeout(url, init, timeoutMs, provider) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, { ...init, signal: controller.signal });
        // Providers may send headers well before their JSON is complete. Keep
        // the deadline active while reading the body, not just the handshake.
        const body = await response.arrayBuffer();
        return new Response([204, 205, 304].includes(response.status) ? null : body, { status: response.status, statusText: response.statusText, headers: response.headers });
    }
    catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
            throw new ProviderError(provider, "timeout", `${provider} request timed out after ${timeoutMs}ms.`);
        }
        throw new ProviderError(provider, "unavailable", `${provider} request failed: ${err.message}`);
    }
    finally {
        clearTimeout(timer);
    }
}
export function classifyHttpStatus(status) {
    if (status === 401 || status === 403)
        return "auth";
    if (status === 429)
        return "rate_limited";
    if (status >= 500)
        return "unavailable";
    return "invalid_response";
}
/** Best-effort extraction of a short human-readable message from a provider's error body. */
export async function safeReadErrorMessage(response) {
    try {
        const body = (await response.json());
        if (typeof body?.error === "string")
            return body.error.slice(0, 300);
        return body?.error?.message?.slice(0, 300) ?? null;
    }
    catch {
        return null;
    }
}

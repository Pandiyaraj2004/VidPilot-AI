/**
 * Backend-only YouTube provider abstraction (Phase 11) — mirrors the
 * project's existing VisualProvider pattern: the upload
 * workflow (youtubeUploadService.ts, jobService.ts) depends only on this
 * interface, never on the Google APIs client directly.
 * YouTubeDataApiProvider (youtubeDataApiProvider.ts) is the one real
 * implementation; FakeYouTubeProvider (test-only) lets the rest of the
 * suite stay deterministic without a real Google account.
 */
export class YouTubeApiError extends Error {
    reason;
    constructor(message, 
    /** Lets callers distinguish "token is dead, user must reconnect" from a transient/quota failure without parsing message text. */
    reason = "api_error") {
        super(message);
        this.reason = reason;
        this.name = "YouTubeApiError";
    }
}

import { randomUUID } from "node:crypto";
import { config } from "../config/env.js";
import { youtubeProvider } from "../services/youtube/index.js";
// Single-user app: only one OAuth flow is ever in flight at a time, so a
// module-level pending state is enough real CSRF protection (the callback
// must present the exact state this process just minted) without needing
// session storage for a one-person tool.
let pendingState = null;
export async function getYoutubeStatusHandler(_req, res, next) {
    try {
        const connected = await youtubeProvider.isConnected();
        const channel = connected ? await youtubeProvider.getChannelInfo() : null;
        res.json({ connected, channel, configured: youtubeProvider.isConfigured(), error: await youtubeProvider.getConnectionError?.() ?? null });
    }
    catch (err) {
        next(err);
    }
}
export function getYoutubeAuthHandler(_req, res, next) {
    try {
        if (!youtubeProvider.isConfigured()) {
            res.status(400).json({ error: "YouTube is not configured (missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET)." });
            return;
        }
        pendingState = randomUUID();
        res.json({ url: youtubeProvider.getAuthUrl(pendingState) });
    }
    catch (err) {
        next(err);
    }
}
export async function getYoutubeCallbackHandler(req, res) {
    const { code, state, error } = req.query;
    const expectedState = pendingState;
    pendingState = null;
    if (typeof error === "string") {
        res.redirect(`${config.youtube.frontendUrl}/?youtube=denied`);
        return;
    }
    if (typeof state !== "string" || !expectedState || state !== expectedState) {
        res.redirect(`${config.youtube.frontendUrl}/?youtube=error&reason=state_mismatch`);
        return;
    }
    if (typeof code !== "string") {
        res.redirect(`${config.youtube.frontendUrl}/?youtube=error&reason=missing_code`);
        return;
    }
    try {
        await youtubeProvider.handleCallback(code);
        if (process.env.WORKER_ENABLED === "true") {
            const { getSchedulerService } = await import("../services/scheduler/index.js");
            getSchedulerService().startLoop();
        }
        res.redirect(`${config.youtube.frontendUrl}/?youtube=connected`);
    }
    catch {
        // The real cause is logged server-side by the global error handler in
        // other flows, but this endpoint's failure mode is a browser redirect,
        // not a JSON error the frontend could read — so the reason is
        // deliberately generic here rather than echoing a raw Google error
        // string into a URL.
        res.redirect(`${config.youtube.frontendUrl}/?youtube=error&reason=connect_failed`);
    }
}
export async function disconnectYoutubeHandler(_req, res, next) {
    try {
        await youtubeProvider.disconnect();
        res.json({ connected: false, channel: null });
    }
    catch (err) {
        next(err);
    }
}

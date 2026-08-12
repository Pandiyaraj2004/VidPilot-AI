import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { config } from "../config/env.js";
import { youtubeProvider } from "../services/youtube/index.js";

// Single-user app: only one OAuth flow is ever in flight at a time, so a
// module-level pending state is enough real CSRF protection (the callback
// must present the exact state this process just minted) without needing
// session storage for a one-person tool.
let pendingState: string | null = null;

export async function getYoutubeStatusHandler(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const connected = await youtubeProvider.isConnected();
    const channel = connected ? await youtubeProvider.getChannelInfo() : null;
    res.json({ connected, channel, configured: youtubeProvider.isConfigured() });
  } catch (err) {
    next(err);
  }
}

export function getYoutubeAuthHandler(_req: Request, res: Response, next: NextFunction): void {
  try {
    if (!youtubeProvider.isConfigured()) {
      res.status(400).json({ error: "YouTube is not configured (missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET)." });
      return;
    }
    pendingState = randomUUID();
    res.redirect(youtubeProvider.getAuthUrl(pendingState));
  } catch (err) {
    next(err);
  }
}

export async function getYoutubeCallbackHandler(req: Request, res: Response): Promise<void> {
  const { code, state, error } = req.query;
  const expectedState = pendingState;
  pendingState = null;

  if (typeof error === "string") {
    res.redirect(`${config.youtube.frontendUrl}/settings?youtube=denied`);
    return;
  }
  if (typeof state !== "string" || !expectedState || state !== expectedState) {
    res.redirect(`${config.youtube.frontendUrl}/settings?youtube=error&reason=state_mismatch`);
    return;
  }
  if (typeof code !== "string") {
    res.redirect(`${config.youtube.frontendUrl}/settings?youtube=error&reason=missing_code`);
    return;
  }

  try {
    await youtubeProvider.handleCallback(code);
    res.redirect(`${config.youtube.frontendUrl}/settings?youtube=connected`);
  } catch {
    // The real cause is logged server-side by the global error handler in
    // other flows, but this endpoint's failure mode is a browser redirect,
    // not a JSON error the frontend could read — so the reason is
    // deliberately generic here rather than echoing a raw Google error
    // string into a URL.
    res.redirect(`${config.youtube.frontendUrl}/settings?youtube=error&reason=connect_failed`);
  }
}

export async function disconnectYoutubeHandler(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await youtubeProvider.disconnect();
    res.json({ connected: false, channel: null });
  } catch (err) {
    next(err);
  }
}

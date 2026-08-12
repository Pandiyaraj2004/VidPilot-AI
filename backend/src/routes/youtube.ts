import { Router } from "express";
import {
  disconnectYoutubeHandler,
  getYoutubeAuthHandler,
  getYoutubeCallbackHandler,
  getYoutubeStatusHandler,
} from "../controllers/youtubeController.js";

export const youtubeRouter = Router();

youtubeRouter.get("/youtube/status", getYoutubeStatusHandler);
// Real browser redirects, not fetch() calls — the frontend navigates here
// directly (window.location.href), Google's consent screen is a real page,
// and the callback below is Google redirecting the browser back to us.
youtubeRouter.get("/youtube/auth", getYoutubeAuthHandler);
youtubeRouter.get("/youtube/callback", getYoutubeCallbackHandler);
youtubeRouter.post("/youtube/disconnect", disconnectYoutubeHandler);

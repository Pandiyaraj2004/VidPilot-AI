import { getSchedulerService } from "../services/scheduler/index.js";
import { youtubeProvider } from "../services/youtube/index.js";
export async function getSystemStatus(_req, res, next) { try {
    res.json({ vidpilot: "operational", automation: (await getSchedulerService().getConfig()).automationEnabled ? "enabled" : "idle", youtube: await youtubeProvider.isConnected() ? "connected" : "not_connected" });
}
catch (e) {
    next(e);
} }

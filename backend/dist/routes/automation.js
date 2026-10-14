import { Router } from "express";
import { getSchedulerService } from "../services/scheduler/index.js";
import { AutomationHistory } from "../services/scheduler/automationHistory.js";
import { selectNextVariation } from "../services/scheduler/variationEngine.js";
import { createJob } from "../services/jobs/jobService.js";
import { jobRepository } from "../services/jobs/index.js";
import { Lease } from "../services/runtime/lease.js";
import { youtubeProvider } from "../services/youtube/index.js";
export const automationRouter = Router();
const scheduler = getSchedulerService();
const history = new AutomationHistory();
async function getAutomationHandler(_req, res, next) {
    try {
        const config = await scheduler.getConfig();
        const eventLog = await history.read();
        res.json({
            config,
            history: eventLog,
        });
    }
    catch (err) {
        next(err);
    }
}
async function updateAutomationHandler(req, res, next) {
    try {
        const saved = await scheduler.updateConfig(req.body);
        res.json(saved);
    }
    catch (err) {
        next(err);
    }
}
async function runNowHandler(_req, res, next) {
    const lease = new Lease("manual-generation");
    let held = false;
    try {
        if (!await youtubeProvider.isConnected()) {
            res.status(409).json({ error: "Connect YouTube in Settings before generating and uploading." });
            return;
        }
        held = await lease.acquire();
        if (!held) {
            res.status(409).json({ error: "A manual generation request is already being created." });
            return;
        }
        const existing = (await jobRepository.listJobs({ limit: 1000 })).find(j => j.source === "manual" && j.retentionManaged && !["published", "failed", "cancelled"].includes(j.status));
        if (existing) {
            await lease.release();
            held = false;
            res.status(202).json({ jobId: existing.id, reused: true });
            return;
        }
        const config = await scheduler.getConfig();
        const v = selectNextVariation(config.contentCategories, config.languages, config.enabledVoices, await history.read(), 50, 60, config.defaultStyle);
        const job = await createJob({ topic: v.topic, style: v.style, contentCategory: v.category, durationSeconds: v.durationSeconds, language: v.language, voiceId: v.voiceId, voiceSpeed: 1, visualStyle: "cinematic", subtitlesEnabled: true, youtubeVisibility: config.youtubeVisibility, source: "manual" });
        await history.record({ eventType: "job_created", jobId: job.id, topic: v.topic, category: v.category, language: v.language, voice: v.voiceId, style: v.style, targetDuration: v.durationSeconds });
        await lease.release();
        held = false;
        res.status(202).json({ jobId: job.id, reused: false });
    }
    catch (err) {
        next(err);
    }
    finally {
        if (held)
            try {
                await lease.release();
            }
            catch (err) {
                console.error("Manual generation lease release failed; its expiry protects the queue:", err);
            }
    }
}
automationRouter.get("/automation", getAutomationHandler);
automationRouter.put("/automation", updateAutomationHandler);
automationRouter.post("/automation/run-now", runNowHandler);

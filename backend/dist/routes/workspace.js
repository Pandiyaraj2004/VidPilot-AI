import { Router } from "express";
import { jobRepository } from "../services/jobs/index.js";
import { storageManager } from "../services/storage/storageManager.js";
import { runtimeState } from "../services/runtime/state.js";
import { getSchedulerService } from "../services/scheduler/index.js";
import { ACTIVE, runCleanup } from "../services/maintenance/cleanup.js";
import { readWorker } from "../services/runtime/workerStatus.js";
export const workspaceRouter = Router();
workspaceRouter.get("/workspace", async (_req, res, next) => {
    try {
        const jobs = await jobRepository.listJobs({ limit: 1000 });
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        res.json({ jobs: jobs.filter(j => !j.hiddenAt).map(j => ({ id: j.id, title: j.content?.title ?? j.topic, createdAt: j.createdAt, status: j.status, error: j.lastError, url: j.youtube?.url, attempts: j.attempts ?? 0, category: j.contentCategory, language: j.language, voiceId: j.voiceId, style: j.style, durationSeconds: j.videoRender?.durationSeconds ?? j.durationSeconds })),
            overview: { generatedToday: jobs.filter(j => j.videoRender?.generatedAt && Date.parse(j.videoRender.generatedAt) >= +today).length, uploaded: jobs.filter(j => j.status === "published").length, active: jobs.filter(j => ACTIVE.has(j.status)).length, failed: jobs.filter(j => j.status === "failed").length },
            worker: await readWorker(), storage: await storageManager.usage(), cleanup: await runtimeState.get("cleanup:last"), cleanupFailure: await runtimeState.get("cleanup:failed"), settings: await getSchedulerService().getConfig() });
    }
    catch (e) {
        next(e);
    }
});
workspaceRouter.post("/history/clear", async (req, res, next) => {
    try {
        const ids = req.body?.ids;
        if (ids !== undefined && (!Array.isArray(ids) || ids.length === 0 || ids.length > 1000 || ids.some(id => typeof id !== "string" || !id.trim()))) {
            res.status(400).json({ error: "Select between 1 and 1000 valid job IDs." });
            return;
        }
        const selected = ids === undefined ? null : new Set(ids);
        let cleared = 0;
        for (const j of await jobRepository.listJobs({ limit: 10000 }))
            if (!ACTIVE.has(j.status) && !j.hiddenAt && (!selected || selected.has(j.id))) {
                await jobRepository.updateJob(j.id, { hiddenAt: new Date().toISOString() });
                cleared++;
            }
        res.json({ ok: true, cleared });
    }
    catch (e) {
        next(e);
    }
});
workspaceRouter.post("/maintenance/cleanup", async (_req, res, next) => { try {
    const result = await runCleanup(true);
    res.status(result.errors?.length ? 503 : 200).json(result);
}
catch (e) {
    next(e);
} });

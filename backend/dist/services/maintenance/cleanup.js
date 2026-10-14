import { readdir, lstat, unlink, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { config } from "../../config/env.js";
import { jobRepository } from "../jobs/index.js";
import { storageManager, expired } from "../storage/storageManager.js";
import { runtimeState } from "../runtime/state.js";
import { Lease } from "../runtime/lease.js";
import { removeOwnedDirectory } from "../runtime/safePaths.js";
import { getSupabaseClient, isSupabaseConfigured } from "../supabase/index.js";
export const ACTIVE = new Set(["queued", "generating_script", "script_ready", "generating_voice", "voice_ready", "generating_visuals", "generating_subtitles", "rendering", "video_validation", "video_ready", "quality_check", "qc_passed", "uploading"]);
let pending = null;
export function runCleanup(force = false) {
    if (pending)
        return pending;
    pending = cleanup(force).finally(() => { pending = null; });
    return pending;
}
async function cleanup(force) {
    let activated = await runtimeState.get("retention:activated");
    if (!activated) {
        activated = { at: new Date().toISOString() };
        await runtimeState.set("retention:activated", activated);
    }
    const last = await runtimeState.get("cleanup:last");
    const failed = await runtimeState.get("cleanup:failed");
    if (!force && last && (!failed || failed.at < last.at) && Date.now() - Date.parse(last.at) < 24 * 3600000)
        return last;
    const lease = new Lease("cleanup");
    if (!await lease.acquire())
        return { busy: true };
    let count = 0, freedBytes = 0;
    const errors = [];
    try {
        const jobs = await jobRepository.listJobs({ limit: 10000 });
        const active = jobs.filter(j => j.retentionManaged && (ACTIVE.has(j.status) || (j.attempts ?? 0) < 3 && j.status === "failed" && j.youtube?.status !== "uncertain"));
        const objects = await storageManager.inventory();
        for (const object of objects) {
            if (!object.name.startsWith("vp1/") || (active.length > 0 && object.bucket === "visual-cache") || !expired(object.created_at) || active.some(j => object.name.split("/").includes(j.id)))
                continue;
            await lease.assertHeld();
            try {
                await storageManager.remove(object);
                count++;
                freedBytes += object.bytes;
            }
            catch (e) {
                errors.push(e.message);
            }
        }
        for (const job of jobs) {
            if (!job.retentionManaged || ACTIVE.has(job.status) || !expired(job.createdAt) || job.status === "failed" && (job.attempts ?? 0) < 3 && job.youtube?.status !== "uncertain")
                continue;
            try {
                await lease.assertHeld();
                if (job.youtubeVideoId)
                    await runtimeState.set(`publication:${job.id}`, { status: "published", videoId: job.youtubeVideoId, createdAt: job.publishedAt });
                freedBytes += await removeOwnedDirectory(config.rendering.storageDir, job.id) ?? 0;
                if (config.piper.storageDir !== config.rendering.storageDir)
                    freedBytes += await removeOwnedDirectory(config.piper.storageDir, job.id) ?? 0;
                await jobRepository.deleteJob(job.id);
                count++;
            }
            catch (e) {
                errors.push(e.message);
            }
        }
        // Shared cache files may be referenced by any active job; conservatively keep them while work exists.
        if (active.length === 0)
            for (const dir of [config.visuals.assetCacheDir, config.music.jamendoCacheDir]) {
                try {
                    if ((await lstat(dir)).isSymbolicLink())
                        throw new Error("Refusing symlink cache cleanup");
                    for (const name of await readdir(dir)) {
                        await lease.assertHeld();
                        const file = path.join(dir, name), s = await lstat(file);
                        if (s.isDirectory() && !s.isSymbolicLink() && s.birthtimeMs >= Date.parse(activated.at) && expired(s.birthtime.toISOString())) {
                            freedBytes += await removeOwnedDirectory(dir, name) ?? 0;
                            count++;
                        }
                        else if (s.isFile() && !s.isSymbolicLink() && s.birthtimeMs >= Date.parse(activated.at) && expired(s.birthtime.toISOString())) {
                            await unlink(file);
                            count++;
                            freedBytes += s.size;
                        }
                    }
                }
                catch (e) {
                    if (e.code !== "ENOENT")
                        errors.push(e.message);
                }
            }
        if (isSupabaseConfigured()) {
            await lease.assertHeld();
            const { error } = await getSupabaseClient().from("automation_history").delete().gte("data->>timestamp", activated.at).lt("data->>timestamp", new Date(Date.now() - 7 * 86400000).toISOString());
            if (error)
                errors.push(error.message);
        }
        else {
            const historyFile = path.join(process.env.SCHEDULER_DATA_DIR ?? path.join(process.cwd(), "storage"), "automationHistory.json");
            try {
                const entries = JSON.parse(await readFile(historyFile, "utf8"));
                const keep = entries.filter(e => e.timestamp < activated.at || !expired(e.timestamp));
                if (keep.length !== entries.length) {
                    await writeFile(historyFile, JSON.stringify(keep));
                    count += entries.length - keep.length;
                }
            }
            catch (e) {
                if (e.code !== "ENOENT")
                    errors.push(e.message);
            }
        }
        await lease.assertHeld();
        const result = { at: new Date().toISOString(), count, freedBytes, errors };
        await runtimeState.set(errors.length ? "cleanup:failed" : "cleanup:last", result);
        console.info("Retention cleanup", result);
        return result;
    }
    finally {
        await lease.release();
    }
}
export async function cleanupPublishedJob(id) {
    const job = await jobRepository.getJob(id);
    if (job?.status !== "published" || !job.retentionManaged)
        return;
    await removeOwnedDirectory(config.rendering.storageDir, id);
    if (config.piper.storageDir !== config.rendering.storageDir)
        await removeOwnedDirectory(config.piper.storageDir, id);
    for (const o of await storageManager.inventory())
        if (o.name.split("/").includes(id))
            await storageManager.remove(o);
    await cleanupUnusedCaches();
}
export async function cleanupUnusedCaches() {
    const active = (await jobRepository.listJobs({ limit: 10000 })).some(j => j.retentionManaged && ACTIVE.has(j.status));
    if (active)
        return;
    for (const dir of [config.visuals.assetCacheDir, config.music.jamendoCacheDir]) {
        const ownedRoots = [path.resolve(process.env.MEDIA_TEMP_DIR ?? path.join(tmpdir(), "vidpilot-ai")), path.resolve(process.cwd(), "storage")];
        if (!ownedRoots.some(root => path.dirname(path.resolve(dir)) === root) || !["visual-cache", "jamendo-cache"].includes(path.basename(dir)))
            continue;
        await removeOwnedDirectory(path.dirname(dir), path.basename(dir));
    }
}
export async function cleanupFailedWorkspace(id) {
    const job = await jobRepository.getJob(id);
    if (!job?.retentionManaged || job.status !== "failed" || (job.attempts ?? 0) < 3 && job.youtube?.status !== "uncertain")
        return;
    await removeOwnedDirectory(config.rendering.storageDir, id);
    if (config.piper.storageDir !== config.rendering.storageDir)
        await removeOwnedDirectory(config.piper.storageDir, id);
    await cleanupUnusedCaches();
}

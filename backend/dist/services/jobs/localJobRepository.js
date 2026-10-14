import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
// Serializes reads/writes per data file so concurrent requests never race —
// keyed by file path so test instances (custom dataDir) don't share a lock
// with the real one.
const queues = new Map();
function sequential(key, task) {
    const previous = queues.get(key) ?? Promise.resolve();
    const result = previous.then(task, task);
    queues.set(key, result.catch(() => undefined));
    return result;
}
/**
 * JSON-file-backed job store used when no Firebase project is configured.
 * Same interface as FirestoreJobRepository, so the rest of the app is
 * identical either way — see services/jobs/index.ts for the switch.
 *
 * `dataDir` defaults to `<cwd>/data` (the real dev/prod location) but can be
 * overridden — tests pass a throwaway temp directory so they never touch
 * the real jobs.local.json.
 */
export class LocalJobRepository {
    dataFile;
    constructor(dataDir = process.env.JOB_DATA_DIR ?? path.join(process.cwd(), "data")) {
        this.dataFile = path.join(dataDir, "jobs.local.json");
    }
    async deleteJob(id) {
        await sequential(this.dataFile, async () => { const jobs = await this.readAll(); await writeFile(this.dataFile, JSON.stringify(jobs.filter(j => j.id !== id)), "utf8"); });
    }
    async readAll() {
        try {
            const raw = await readFile(this.dataFile, "utf-8");
            return JSON.parse(raw);
        }
        catch (err) {
            if (err.code === "ENOENT")
                return [];
            throw err;
        }
    }
    async writeAll(jobs) {
        await mkdir(path.dirname(this.dataFile), { recursive: true });
        await writeFile(this.dataFile, JSON.stringify(jobs, null, 2), "utf-8");
    }
    async createJob(input) {
        return sequential(this.dataFile, async () => {
            const jobs = await this.readAll();
            const now = new Date().toISOString();
            const job = {
                retentionManaged: true,
                id: randomUUID(),
                topic: input.topic.trim(),
                inputScript: input.inputScript?.trim() || null,
                style: input.style,
                contentCategory: input.contentCategory,
                durationSeconds: input.durationSeconds,
                language: input.language,
                voiceId: input.voiceId,
                voiceSpeed: input.voiceSpeed,
                visualStyle: input.visualStyle,
                subtitlesEnabled: input.subtitlesEnabled,
                youtubeVisibility: input.youtubeVisibility,
                status: "queued",
                content: null,
                scriptProvider: null,
                scriptModel: null,
                scriptGeneratedAt: null,
                voiceGeneration: null,
                renderTemplate: null,
                videoRender: null,
                qualityReport: null,
                renderVersion: 0,
                youtube: null,
                lastError: null,
                retryCount: 0,
                createdAt: now,
                updatedAt: now,
                publishedAt: null,
                youtubeVideoId: null,
                source: input.source || "manual",
            };
            jobs.unshift(job);
            await this.writeAll(jobs);
            return job;
        });
    }
    async getJob(id) {
        const jobs = await this.readAll();
        return jobs.find((job) => job.id === id) ?? null;
    }
    async listJobs(filter) {
        let jobs = await this.readAll();
        if (filter?.status) {
            jobs = jobs.filter((job) => job.status === filter.status);
        }
        if (filter?.search) {
            const term = filter.search.trim().toLowerCase();
            jobs = jobs.filter((job) => job.topic.toLowerCase().includes(term) || job.id.toLowerCase().includes(term));
        }
        if (filter?.limit !== undefined) {
            jobs = jobs.slice(0, filter.limit);
        }
        return jobs;
    }
    async updateJobStatus(id, status) {
        return this.updateJob(id, { status });
    }
    async updateJob(id, patch) {
        return sequential(this.dataFile, async () => {
            const jobs = await this.readAll();
            const index = jobs.findIndex((job) => job.id === id);
            if (index === -1) {
                throw new Error(`Job ${id} not found.`);
            }
            const updated = { ...jobs[index], ...patch, id, updatedAt: new Date().toISOString() };
            jobs[index] = updated;
            await this.writeAll(jobs);
            return updated;
        });
    }
}

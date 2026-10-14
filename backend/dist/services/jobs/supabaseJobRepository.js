import { getSupabaseClient } from "../supabase/index.js";
const TABLE = "jobs";
const LIST_LIMIT = 200;
export class SupabaseJobRepository {
    async deleteJob(id) { const { error } = await getSupabaseClient().from(TABLE).delete().eq("id", id); if (error)
        throw new Error(error.message); }
    async createJob(input) {
        const now = new Date().toISOString();
        // Generate a unique ID (mock doc ID generation using crypto)
        const id = crypto.randomUUID();
        const job = {
            retentionManaged: true,
            id,
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
        const { error } = await getSupabaseClient().from(TABLE).insert({
            id,
            status: job.status,
            topic: job.topic,
            data: job,
        });
        if (error) {
            throw new Error(`Failed to create job in Supabase: ${error.message}`);
        }
        return job;
    }
    async getJob(id) {
        const { data, error } = await getSupabaseClient()
            .from(TABLE)
            .select("data")
            .eq("id", id)
            .maybeSingle();
        if (error) {
            throw new Error(`Failed to fetch job from Supabase: ${error.message}`);
        }
        return data ? data.data : null;
    }
    async listJobs(filter) {
        const fetchLimit = filter?.limit !== undefined ? filter.limit : LIST_LIMIT;
        let jobs = [];
        for (let offset = 0; offset < fetchLimit; offset += 1000) {
            let query = getSupabaseClient().from(TABLE).select("data").order("created_at", { ascending: false }).range(offset, Math.min(offset + 999, fetchLimit - 1));
            if (filter?.status)
                query = query.eq("status", filter.status);
            const { data, error } = await query;
            if (error)
                throw new Error(`Failed to list jobs: ${error.message}`);
            jobs.push(...(data ?? []).map(row => row.data));
            if (!data || data.length < 1000)
                break;
        }
        if (filter?.search) {
            const term = filter.search.trim().toLowerCase();
            jobs = jobs.filter((job) => job.topic.toLowerCase().includes(term) || job.id.toLowerCase().includes(term));
        }
        return jobs;
    }
    async updateJobStatus(id, status) {
        return this.updateJob(id, { status });
    }
    async updateJob(id, patch) {
        const existing = await this.getJob(id);
        if (!existing) {
            throw new Error(`Job ${id} not found for update`);
        }
        const now = new Date().toISOString();
        const updatedJob = {
            ...existing,
            ...patch,
            updatedAt: now,
        };
        const { error } = await getSupabaseClient()
            .from(TABLE)
            .update({
            status: updatedJob.status,
            topic: updatedJob.topic,
            data: updatedJob,
            updated_at: now,
        })
            .eq("id", id);
        if (error) {
            throw new Error(`Failed to update job in Supabase: ${error.message}`);
        }
        return updatedJob;
    }
}

import { getSupabaseClient } from "../supabase/index.js";
import type { CreateJobInput, JobStatus, VideoJob } from "../../types/index.js";
import type { JobRepository, ListJobsFilter } from "./jobRepository.js";

const TABLE = "jobs";
const LIST_LIMIT = 200;

export class SupabaseJobRepository implements JobRepository {
  async createJob(input: CreateJobInput): Promise<VideoJob> {
    const now = new Date().toISOString();
    // Generate a unique ID (mock doc ID generation using crypto)
    const id = crypto.randomUUID();
    const job: VideoJob = {
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
      thumbnailEnabled: input.thumbnailEnabled,
      approvalRequired: input.approvalRequired,
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
      approval: null,
      thumbnail: null,
      youtube: null,
      lastError: null,
      retryCount: 0,
      createdAt: now,
      updatedAt: now,
      approvedAt: null,
      publishedAt: null,
      youtubeVideoId: null,
      telegramMessageId: null,
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

  async getJob(id: string): Promise<VideoJob | null> {
    const { data, error } = await getSupabaseClient()
      .from(TABLE)
      .select("data")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch job from Supabase: ${error.message}`);
    }

    return data ? (data.data as VideoJob) : null;
  }

  async listJobs(filter?: ListJobsFilter): Promise<VideoJob[]> {
    const fetchLimit = filter?.limit !== undefined ? filter.limit : LIST_LIMIT;
    let query = getSupabaseClient()
      .from(TABLE)
      .select("data")
      .order("created_at", { ascending: false })
      .limit(fetchLimit);

    if (filter?.status) {
      query = query.eq("status", filter.status);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to list jobs from Supabase: ${error.message}`);
    }

    let jobs = (data || []).map((row) => row.data as VideoJob);

    if (filter?.search) {
      const term = filter.search.trim().toLowerCase();
      jobs = jobs.filter((job) => job.topic.toLowerCase().includes(term) || job.id.toLowerCase().includes(term));
    }

    return jobs;
  }

  async updateJobStatus(id: string, status: JobStatus): Promise<VideoJob> {
    return this.updateJob(id, { status });
  }

  async updateJob(id: string, patch: Partial<VideoJob>): Promise<VideoJob> {
    const existing = await this.getJob(id);
    if (!existing) {
      throw new Error(`Job ${id} not found for update`);
    }

    const now = new Date().toISOString();
    const updatedJob: VideoJob = {
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

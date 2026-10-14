import { getSupabaseClient } from "../supabase/index.js";
import type { CreateJobInput, JobStatus, VideoJob } from "../../types/index.js";
import type { JobRepository, ListJobsFilter } from "./jobRepository.js";

const TABLE = "jobs";
const LIST_LIMIT = 200;

export class SupabaseJobRepository implements JobRepository {
  async deleteJob(id:string):Promise<void> {const {error}=await getSupabaseClient().from(TABLE).delete().eq("id",id);if(error)throw new Error(error.message);}
  async createJob(input: CreateJobInput): Promise<VideoJob> {
    const now = new Date().toISOString();
    // Generate a unique ID (mock doc ID generation using crypto)
    const id = crypto.randomUUID();
    const job: VideoJob = {
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
    let jobs:VideoJob[]=[];
    for(let offset=0;offset<fetchLimit;offset+=1000){
      let query=getSupabaseClient().from(TABLE).select("data").order("created_at",{ascending:false}).range(offset,Math.min(offset+999,fetchLimit-1));
      if(filter?.status)query=query.eq("status",filter.status);
      const {data,error}=await query;if(error)throw new Error(`Failed to list jobs: ${error.message}`);
      jobs.push(...(data??[]).map(row=>row.data as VideoJob));if(!data||data.length<1000)break;
    }

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

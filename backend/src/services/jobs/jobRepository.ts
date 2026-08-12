import type { CreateJobInput, JobStatus, VideoJob } from "../../types/index.js";

export interface ListJobsFilter {
  status?: JobStatus;
  search?: string;
  limit?: number;
}

/**
 * Persistence contract for video jobs. FirestoreJobRepository (real Admin SDK)
 * and LocalJobRepository (JSON file) both implement this — callers never
 * know or care which one is active. See services/jobs/index.ts for selection.
 */
export interface JobRepository {
  createJob(input: CreateJobInput): Promise<VideoJob>;
  getJob(id: string): Promise<VideoJob | null>;
  listJobs(filter?: ListJobsFilter): Promise<VideoJob[]>;
  updateJobStatus(id: string, status: JobStatus): Promise<VideoJob>;
  /** General partial update (e.g. saving generated content alongside a status change) — always stamps updatedAt. */
  updateJob(id: string, patch: Partial<VideoJob>): Promise<VideoJob>;
}

import { apiGet, apiPatch, apiPost, apiUrl } from "@/services/api/client";
import type { CreateJobInput, JobApproval, JobStatus, VideoJob } from "@/types";

export interface ListJobsFilter {
  status?: JobStatus;
  search?: string;
}

/**
 * Talks to the backend's REST API, never to Firestore directly — the
 * frontend has no Firebase Admin credentials and never will. See the
 * project README for why job persistence is backend-mediated.
 */
export const jobRepository = {
  createJob(input: CreateJobInput): Promise<VideoJob> {
    return apiPost<VideoJob>("/jobs", input);
  },

  getJob(id: string): Promise<VideoJob> {
    return apiGet<VideoJob>(`/jobs/${encodeURIComponent(id)}`);
  },

  listJobs(filter?: ListJobsFilter): Promise<VideoJob[]> {
    const params = new URLSearchParams();
    if (filter?.status) params.set("status", filter.status);
    if (filter?.search) params.set("search", filter.search);
    const query = params.toString();
    return apiGet<VideoJob[]>(`/jobs${query ? `?${query}` : ""}`);
  },

  cancelJob(id: string): Promise<VideoJob> {
    return apiPatch<VideoJob>(`/jobs/${encodeURIComponent(id)}/cancel`);
  },

  retryJob(id: string): Promise<VideoJob> {
    return apiPatch<VideoJob>(`/jobs/${encodeURIComponent(id)}/retry`);
  },

  generateScript(id: string): Promise<VideoJob> {
    return apiPost<VideoJob>(`/jobs/${encodeURIComponent(id)}/generate-script`);
  },

  regenerateScript(id: string, instruction?: string): Promise<VideoJob> {
    return apiPost<VideoJob>(`/jobs/${encodeURIComponent(id)}/regenerate-script`, instruction ? { instruction } : undefined);
  },

  generateVoice(id: string): Promise<VideoJob> {
    return apiPost<VideoJob>(`/jobs/${encodeURIComponent(id)}/generate-voice`);
  },

  regenerateVoice(id: string): Promise<VideoJob> {
    return apiPost<VideoJob>(`/jobs/${encodeURIComponent(id)}/regenerate-voice`);
  },

  regenerateSceneVoice(id: string, sceneId: string): Promise<VideoJob> {
    return apiPost<VideoJob>(`/jobs/${encodeURIComponent(id)}/scenes/${encodeURIComponent(sceneId)}/regenerate-voice`);
  },

  regenerateSceneVisual(id: string, sceneId: string): Promise<VideoJob> {
    return apiPost<VideoJob>(`/jobs/${encodeURIComponent(id)}/scenes/${encodeURIComponent(sceneId)}/regenerate-visual`);
  },

  renderVideo(id: string): Promise<VideoJob> {
    return apiPost<VideoJob>(`/jobs/${encodeURIComponent(id)}/render-video`);
  },

  runQualityCheck(id: string): Promise<VideoJob> {
    return apiPost<VideoJob>(`/jobs/${encodeURIComponent(id)}/quality-check`);
  },

  sendApprovalRequest(id: string): Promise<VideoJob> {
    return apiPost<VideoJob>(`/jobs/${encodeURIComponent(id)}/telegram/send-approval`);
  },

  getApproval(id: string): Promise<JobApproval> {
    return apiGet<JobApproval>(`/jobs/${encodeURIComponent(id)}/approval`);
  },

  uploadToYoutube(id: string): Promise<VideoJob> {
    return apiPost<VideoJob>(`/jobs/${encodeURIComponent(id)}/youtube/upload`);
  },
};

/** Playable URL for a job's finished video — built from the job id, never from a stored filesystem path. */
export function jobVideoUrl(jobId: string): string {
  return apiUrl(`/jobs/${encodeURIComponent(jobId)}/video`);
}

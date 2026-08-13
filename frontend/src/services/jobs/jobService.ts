import { jobRepository, type ListJobsFilter } from "@/services/jobs/jobRepository";
import type { CreateJobInput, JobApproval, VideoJob } from "@/types";

export interface CreateJobFormErrors {
  topic?: string;
  script?: string;
  duration?: string;
}

const MAX_DURATION_MINUTES = 180;

/** Mirrors the backend's validation so the user sees an error before any network round trip. */
export function validateCreateJobInput(
  input: CreateJobInput & { useOwnScript?: boolean }
): CreateJobFormErrors {
  const errors: CreateJobFormErrors = {};

  if (!input.topic.trim()) {
    errors.topic = "Please enter a video topic.";
  }

  if (input.useOwnScript && !input.inputScript?.trim()) {
    errors.script = "Please paste your script, or turn off \"Use my own script\".";
  }

  if (!Number.isFinite(input.durationSeconds) || input.durationSeconds <= 0) {
    errors.duration = "Please enter a valid duration.";
  } else if (input.durationSeconds > MAX_DURATION_MINUTES * 60) {
    errors.duration = `Duration must be ${MAX_DURATION_MINUTES} minutes or less.`;
  }

  return errors;
}

export function hasErrors(errors: CreateJobFormErrors): boolean {
  return Object.keys(errors).length > 0;
}

export async function createJob(input: CreateJobInput): Promise<VideoJob> {
  return jobRepository.createJob(input);
}

export async function getJob(id: string): Promise<VideoJob> {
  return jobRepository.getJob(id);
}

export async function listJobs(filter?: ListJobsFilter): Promise<VideoJob[]> {
  return jobRepository.listJobs(filter);
}

export async function cancelJob(id: string): Promise<VideoJob> {
  return jobRepository.cancelJob(id);
}

export async function retryJob(id: string): Promise<VideoJob> {
  return jobRepository.retryJob(id);
}

export async function generateScript(id: string): Promise<VideoJob> {
  return jobRepository.generateScript(id);
}

export async function regenerateScript(id: string, instruction?: string): Promise<VideoJob> {
  return jobRepository.regenerateScript(id, instruction);
}

export async function generateVoice(id: string): Promise<VideoJob> {
  return jobRepository.generateVoice(id);
}

export async function regenerateVoice(id: string): Promise<VideoJob> {
  return jobRepository.regenerateVoice(id);
}

export async function regenerateSceneVoice(id: string, sceneId: string): Promise<VideoJob> {
  return jobRepository.regenerateSceneVoice(id, sceneId);
}

export async function regenerateSceneVisual(id: string, sceneId: string): Promise<VideoJob> {
  return jobRepository.regenerateSceneVisual(id, sceneId);
}

export async function renderVideo(id: string): Promise<VideoJob> {
  return jobRepository.renderVideo(id);
}

export async function runQualityCheck(id: string): Promise<VideoJob> {
  return jobRepository.runQualityCheck(id);
}

export async function sendApprovalRequest(id: string, options?: { resend?: boolean }): Promise<VideoJob> {
  return jobRepository.sendApprovalRequest(id, options);
}

export async function getApproval(id: string): Promise<JobApproval> {
  return jobRepository.getApproval(id);
}

export async function uploadToYoutube(id: string): Promise<VideoJob> {
  return jobRepository.uploadToYoutube(id);
}

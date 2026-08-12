import { getDb } from "../firebase/index.js";
import type { CreateJobInput, JobStatus, VideoJob } from "../../types/index.js";
import type { JobRepository, ListJobsFilter } from "./jobRepository.js";

const COLLECTION = "jobs";

// Hard cap so a single list call can never pull an unbounded collection.
// Real pagination (cursor-based, via startAfter on this same query shape)
// can be layered on top of this without changing the repository interface.
const LIST_LIMIT = 200;

export class FirestoreJobRepository implements JobRepository {
  async createJob(input: CreateJobInput): Promise<VideoJob> {
    const db = getDb();
    const ref = db.collection(COLLECTION).doc();
    const now = new Date().toISOString();
    const job: VideoJob = {
      id: ref.id,
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
    };
    await ref.set(job);
    return job;
  }

  async getJob(id: string): Promise<VideoJob | null> {
    const db = getDb();
    const snap = await db.collection(COLLECTION).doc(id).get();
    return snap.exists ? (snap.data() as VideoJob) : null;
  }

  async listJobs(filter?: ListJobsFilter): Promise<VideoJob[]> {
    const db = getDb();
    let query = db.collection(COLLECTION).orderBy("createdAt", "desc").limit(LIST_LIMIT) as FirebaseFirestore.Query;

    if (filter?.status) {
      query = query.where("status", "==", filter.status);
    }

    const snap = await query.get();
    let jobs = snap.docs.map((doc) => doc.data() as VideoJob);

    // Firestore has no case-insensitive substring query — filter in memory
    // over the already-limited page, same as LocalJobRepository.
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
    const db = getDb();
    const ref = db.collection(COLLECTION).doc(id);
    const updatedAt = new Date().toISOString();
    await ref.update({ ...patch, updatedAt });
    const snap = await ref.get();
    return snap.data() as VideoJob;
  }
}

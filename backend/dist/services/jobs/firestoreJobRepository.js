import { getDb } from "../firebase/index.js";
const COLLECTION = "jobs";
// Hard cap so a single list call can never pull an unbounded collection.
// Real pagination (cursor-based, via startAfter on this same query shape)
// can be layered on top of this without changing the repository interface.
const LIST_LIMIT = 200;
export class FirestoreJobRepository {
    async deleteJob(id) { await getDb().collection(COLLECTION).doc(id).delete(); }
    async createJob(input) {
        const db = getDb();
        const ref = db.collection(COLLECTION).doc();
        const now = new Date().toISOString();
        const job = {
            retentionManaged: true,
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
        await ref.set(job);
        return job;
    }
    async getJob(id) {
        const db = getDb();
        const snap = await db.collection(COLLECTION).doc(id).get();
        return snap.exists ? snap.data() : null;
    }
    async listJobs(filter) {
        const db = getDb();
        const fetchLimit = filter?.limit !== undefined ? filter.limit : LIST_LIMIT;
        let query = db.collection(COLLECTION).orderBy("createdAt", "desc").limit(fetchLimit);
        if (filter?.status) {
            query = query.where("status", "==", filter.status);
        }
        const snap = await query.get();
        let jobs = snap.docs.map((doc) => doc.data());
        // Firestore has no case-insensitive substring query — filter in memory
        // over the already-limited page, same as LocalJobRepository.
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
        const db = getDb();
        const ref = db.collection(COLLECTION).doc(id);
        const updatedAt = new Date().toISOString();
        await ref.update({ ...patch, updatedAt });
        const snap = await ref.get();
        return snap.data();
    }
}

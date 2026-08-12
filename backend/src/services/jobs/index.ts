import { isFirebaseConfigured } from "../firebase/index.js";
import { FirestoreJobRepository } from "./firestoreJobRepository.js";
import { LocalJobRepository } from "./localJobRepository.js";
import type { JobRepository } from "./jobRepository.js";

export type { JobRepository, ListJobsFilter } from "./jobRepository.js";

/**
 * Selected once at startup based on whether a real Firebase project is
 * configured. Everything downstream (jobService, controllers) depends only
 * on the JobRepository interface, so this is the single place that decides
 * which backend is live.
 */
export const jobRepository: JobRepository = isFirebaseConfigured()
  ? new FirestoreJobRepository()
  : new LocalJobRepository();

import { isFirebaseConfigured } from "../firebase/index.js";
import { FirestoreJobRepository } from "./firestoreJobRepository.js";
import { LocalJobRepository } from "./localJobRepository.js";
import { SupabaseJobRepository } from "./supabaseJobRepository.js";
import type { JobRepository } from "./jobRepository.js";
import { config } from "../../config/env.js";

export type { JobRepository, ListJobsFilter } from "./jobRepository.js";

function isSupabaseConfigured(): boolean {
  return (
    typeof config.supabase.url === "string" &&
    config.supabase.url.trim().length > 0 &&
    typeof config.supabase.serviceRoleKey === "string" &&
    config.supabase.serviceRoleKey.trim().length > 0 &&
    process.env.FORCE_LOCAL_STORAGE !== "true"
  );
}

export const jobRepository: JobRepository = isSupabaseConfigured()
  ? new SupabaseJobRepository()
  : isFirebaseConfigured()
  ? new FirestoreJobRepository()
  : new LocalJobRepository();

import { isFirebaseConfigured } from "../firebase/index.js";
import { FirestoreJobRepository } from "./firestoreJobRepository.js";
import { LocalJobRepository } from "./localJobRepository.js";
import { SupabaseJobRepository } from "./supabaseJobRepository.js";
import { config } from "../../config/env.js";
function isSupabaseConfigured() {
    return (typeof config.supabase.url === "string" &&
        config.supabase.url.trim().length > 0 &&
        typeof config.supabase.serviceRoleKey === "string" &&
        config.supabase.serviceRoleKey.trim().length > 0 &&
        process.env.FORCE_LOCAL_STORAGE !== "true");
}
export const jobRepository = isSupabaseConfigured()
    ? new SupabaseJobRepository()
    : isFirebaseConfigured()
        ? new FirestoreJobRepository()
        : new LocalJobRepository();

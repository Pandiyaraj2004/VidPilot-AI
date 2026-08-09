import { config, isConfigured } from "../../config/env.js";

/**
 * Firebase Admin SDK bootstrap placeholder. Phase 1 only exposes whether
 * credentials are present; it does not initialize the SDK or create any
 * Firestore collections. Job/video/analytics persistence is added
 * incrementally starting Phase 2.
 */
export function isFirebaseConfigured(): boolean {
  return isConfigured(config.firebase.projectId) && isConfigured(config.firebase.serviceAccountJson);
}

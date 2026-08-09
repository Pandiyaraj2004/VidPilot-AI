/**
 * Firebase client SDK bootstrap placeholder. Phase 1 does not initialize
 * Firestore or read/write any collection — job/video persistence lands
 * incrementally starting Phase 2. VITE_FIREBASE_* values are safe to expose
 * to the browser (Firebase web config is not a secret), but no other
 * VITE_-prefixed variable should ever hold private API keys or tokens.
 */
export function isFirebaseConfigured(): boolean {
  return Boolean(import.meta.env.VITE_FIREBASE_PROJECT_ID);
}

import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { config, isConfigured } from "../../config/env.js";

/**
 * Firebase Admin SDK bootstrap. Only the backend ever touches this — the
 * service account credential must never reach the frontend. When Firebase
 * isn't configured (no project/service account in env), job persistence
 * falls back to a local JSON file so the app is fully functional without
 * a live Firebase project; see services/jobs/index.ts.
 */
export function isFirebaseConfigured(): boolean {
  return isConfigured(config.firebase.projectId) && isConfigured(config.firebase.serviceAccountJson);
}

let app: App | null = null;

function getFirebaseApp(): App {
  if (app) return app;
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not configured (missing FIREBASE_PROJECT_ID or FIREBASE_SERVICE_ACCOUNT).");
  }

  const existing = getApps()[0];
  if (existing) {
    app = existing;
    return app;
  }

  const serviceAccount = JSON.parse(config.firebase.serviceAccountJson as string);
  app = initializeApp({
    credential: cert(serviceAccount),
    projectId: config.firebase.projectId,
  });
  return app;
}

let db: Firestore | null = null;

export function getDb(): Firestore {
  if (db) return db;
  db = getFirestore(getFirebaseApp());
  // Job documents legitimately contain nested optional fields (e.g. a
  // VisualSegment with no content overlay has contentValue: undefined) —
  // Firestore rejects undefined outright by default. Must be set before
  // any other call on this Firestore instance, hence the singleton guard.
  db.settings({ ignoreUndefinedProperties: true });
  return db;
}

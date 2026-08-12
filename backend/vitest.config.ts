import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Phase 6's voice/audio pipeline runs several real ffmpeg subprocesses
    // per test (trim, concat, normalize, mix) — comfortably fast in
    // isolation, but the default 5s timeout can be tight once the full
    // suite runs many test files' subprocesses concurrently.
    testTimeout: 20000,
    // voiceEngine.ts's module-level MusicResolver is not test-injectable, so
    // without this, voiceEngine.test.ts's real credentials (loaded from
    // backend/.env by config/env.ts's `dotenv/config`) make it hit the live
    // Jamendo API on every test run. dotenv never overwrites a variable
    // already present in process.env, so setting it empty here — applied by
    // Vitest before any test file's module graph (and therefore env.ts)
    // loads — forces JamendoMusicProvider's `isConfigured` check to fail
    // fast, exercising the same "not configured, fall back to local
    // library" path jamendoProvider.test.ts already covers directly.
    env: {
      JAMENDO_CLIENT_ID: "",
      JAMENDO_CLIENT_SECRET: "",
    },
  },
});

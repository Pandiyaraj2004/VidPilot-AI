# vidpilot ai Version 1 — verified implementation report

Updated 14 October 2026. Existing repository upgraded in place. Initial Git staging was preserved; no commit, push or cloud deployment was performed.

## Operational result

The approved video, “Unmasking the Moon: Why Its Shape Seems to Change”, was generated using Gemini, English Piper narration, licensed stock visuals/music, captions and the existing Remotion/FFmpeg pipeline. Native output: 23.223 seconds, 1080×1920, 30 fps, H.264/AAC, 8,049,728 bytes. All eight QC categories passed, score 100/100. Rendering resumed after interruption by validating four completed scenes and rendering the fifth; no required scene was dropped.

After the user renewed revoked Google authorization, the automatic worker uploaded it to CurioMentra. Independent YouTube API verification returned Unlisted, processed, duration PT24S:
https://www.youtube.com/watch?v=Q5XIAU9BQcs

The job reached published, the worker returned to Idle, and its temporary cloud copy was deleted. Upload intent and video identifiers remain durable. No YouTube video was deleted. No duplicate upload was attempted.

Dashboard: http://localhost:4000. No login page. Real loopback requests receive a local session; authenticated API protection, origin checks, encrypted OAuth persistence and secret filtering remain. Remote personal access requires the separately generated private access link. Windows sign-in task vidpilot-ai-worker runs the background server, with bounded restart recovery. The existing four-hour schedule is enabled. The computer must remain awake and connected; this cannot run while it is off.

## Implemented fixes

- QC PASS → uploading → published; WARN/FAIL cannot publish. Telegram approval and unfinished thumbnail/analytics interfaces removed.
- Durable publication claims and leases, mandatory pre-upload probing, bounded retries, error recording, uncertain-upload protection and restart recovery.
- Known OAuth/quota rejection releases the attempt safely; unknown upload outcomes remain blocked against duplicate publication. Revoked authorization is displayed as an actionable connection error.
- Structured AI schema, normalized scene IDs, required conclusions/durations, bounded repairs and simple spoken-English rules. Hindi/Tamil support retained. OpenRouter fallback rejects paid models and defaults to openrouter/free.
- Validated downloads, provider error handling, existing audio/caption/render/QC checks retained.
- Media uses OS temporary directories. Successful publication removes local job media and unnecessary owned caches immediately. Exhausted failures remove local media while keeping essential diagnostics/idempotency records.
- One responsive dashboard with real queue, progress, history, settings and storage figures. Browser visual review remains unverified because browser access was denied by the saved permission policy; HTTP/API integration passed.
- Removed broad googleapis in favor of @googleapis/youtube and google-auth-library; removed unused mime-types, its types and frontend react-router-dom. Removed unused ffplay binary, freeing another 138,143,232 bytes; required renderer/TTS binaries retained.

## Supabase and retention

Migration 001_runtime.sql applied to the verified Vidpilot Ai project. Registered owned buckets: voice-audio, visual-cache, rendered-videos. Actual post-publication usage: 216,976,911 bytes, zero reserved, below the 450,000,000-byte warning and 500,000,000-byte hard cap. Database storage is accounted separately (about 11.5 MB at audit).

Atomic SQL reservations prevent concurrent over-allocation; actual object metadata supplies usage. Content-addressed objects prevent duplicate writes. Streaming uploads and conservative reservations handle unknown outcomes. Deletion verifies ownership and object metadata. Signed application media URLs are used. Legacy bucket public-access settings have not been changed in this pass.

Live rollback SQL checks verified exact-cap acceptance, overflow rejection, duplicate reservations and lease ownership. Real isolated integration accepted two of four concurrent 100 MB reservations at current usage and rejected two, then removed fixtures with identical before/after storage totals. No production records were used as test fixtures.

Managed media expires at creation + seven days. Startup, daily worker, pre-storage and post-publication cleanup paths exist; deletion errors are retried and leases protect concurrent cleanup. Tests cover expiration, active-job protection, failures, retries and compact ledger preservation. The daily GitHub Actions workflow is prepared, but its repository secrets/enabled scheduled execution have not been verified. Legacy historical cloud data remains excluded pending confirmed reset.

## Local cleanup and cloud reset

The explicitly authorized local reset removed 28 historical local job records and 441 verified historical media files totaling 2,160,315,384 bytes (2.16 GB). Backups/manifests and execution evidence are in maintenance/reset-reviewed-complete-manifest.json, reset-local-approved-manifest.json, reset-extra-audio-manifest.json and reset-local-executed.log. These back up metadata, not media bytes. Generated E2E media and temporary dependency-download artifacts were also removed. Settings, credentials, schema and compact publication identifiers were preserved.

The reviewed cloud inventory contains nine historical jobs and 87 objects (216,976,911 bytes). They were not deleted: local deletion authorization does not authorize a cloud reset. Generate a fresh dry run from backend:

    npm run maintenance -- reset-old-data --manifest=../maintenance/reset-reviewed.json

Only after separately confirming that manifest:

    $env:MAINTENANCE_MODE='true'
    npm run maintenance -- reset-old-data --execute --manifest=../maintenance/reset-reviewed.json --confirm=DELETE_OLD_VIDPILOT_DATA
    Remove-Item Env:MAINTENANCE_MODE

New managed jobs and vp1 objects are protected from the old-data reset. Never reuse an already executed or stale manifest.

## Size and deployment

Installed dependencies including development tools: 537.58 MB before, 327.09 MB after. Compiled output reduced from 0.769 MB to about 0.4 MB. Complete measured Windows runtime: 1,247,890,311 bytes, comprising production dependencies 262,971,214, application/assets 6,558,683, required native components/voices 442,143,117 and installed Chrome 536,217,297. This measure already excludes ffplay, generated media and tests.

The full runtime does not meet 500 MB. Linux measurement was attempted but WSL failed to start reliably; no smaller complete Linux size is claimed. Free Render is configured for the API only, with worker disabled and /health. Free-tier rendering capacity is not proven. The existing computer is the verified zero-recurring-cost rendering option. No paid service or billing change was activated. Render/Vercel cloud deployment was not performed; current remote code must not be mistaken for this verified local build.

## Validation evidence

- Full backend run before the final three regression additions: 452/452 passed, including real FFmpeg checks (superseded by the final 455-test report).
- Latest targeted auth, retention/reset, scheduler and schema run: 25/25 passed (maintenance/final-targeted-tests.json).
- Upload/video-quality regression: 40/40 passed (maintenance/upload-regression-tests.json).
- Backend TypeScript and production build passed. Frontend TypeScript, lint and production build passed; JS 207.74 kB (65.48 kB gzip).
- Supabase concurrency integration passed (maintenance/supabase-integration.json).
- Real generated output QC and provider upload verification: maintenance/video-validation-result.json and maintenance/youtube-unlisted-result.json.
- Final complete backend suite after all changes: 455/455 passed, zero failures (maintenance/backend-tests-final.json).

The Git commit history records changed and deleted files, including the initial working changes. Main implementation areas: backend services/jobs, scheduler, runtime, storage, maintenance, ai and youtube; auth/routes; SQL migration; frontend Workspace/styles; build/deployment scripts and package locks. Compiled dist was rebuilt without stale removed modules. No Git index rewrite was performed.

Example of the required simple-English style: “The Moon does not make its own light. It reflects light from the Sun. As it moves around Earth, we see different parts of its bright side.” This illustrates the writing rule, not a claim that this exact wording was generated in the uploaded video.

Remaining limits: complete runtime above 500 MB; Linux/free-cloud rendering unverified; GitHub daily trigger deployment unverified; visual browser QA blocked; legacy cloud reset awaits confirmation; legacy public bucket settings remain. Google may require future reconnection if its OAuth consent configuration expires or revokes refresh tokens. Provider free quotas and computer availability still constrain unattended operation.

Fresh post-publication reset dry run: maintenance/reset-post-upgrade-dry-run.json — 9 historical cloud jobs, 87 objects, 216,976,911 bytes; 0 local historical jobs, 0 local media files, 0 warnings. No cloud deletion performed.

Vercel connection inspection (14 October): the connected account lists five projects, none named vidpilot or linked as a verified target. Existing unrelated projects were left unchanged. No frontend cloud deployment can be verified until the correct existing Vercel project/account is identified.

Pre-deployment refinement: scheduled videos now rotate supported production styles and avoid the immediately previous target duration when the configured range allows it. Language, compatible voice and category continue least-recently-used rotation. Style and duration are saved in automation history. Configured publishing visibility is preserved (current/default Public). History supports checkbox selection, select-all matching results, Clear selected and Clear all, with confirmation; active jobs, YouTube videos and publication identifiers remain protected. Frontend typecheck/lint/build passed; scheduler and history API regression tests run separately from the earlier 455-test baseline.
Refinement verification: all 16 scheduler/variation/history API tests passed. Backend TypeScript passed; production backend and frontend builds passed. No real history entries were cleared during testing.

Repository housekeeping: removed 32 verified obsolete scripts, test artifacts, superseded local logs and outdated audit documents (914,846 bytes), plus empty historical media directories. Reset manifests, the final test report, publication proof, credentials, settings, runtime binaries, voices and deployment output were retained.
# Deployment and maintenance

## Required setup

1. Use Node 22+. Install with `npm ci` for development; build using `npm run build`. Preserve the existing precompiled `backend/dist` deployment strategy. Use `npm ci --omit=dev` on the API deployment.
2. `backend/migrations/001_runtime.sql` was applied and verified in the configured Vidpilot Ai project. For another deployment, apply it after reviewing the target project. It adds durable runtime state, leases, upload reservations and storage accounting. Existing jobs/scheduler/history tables are still required.
3. Verify every application-owned bucket, then register its exact name in `public.vidpilot_buckets`. Do not register unrelated/shared buckets. The migration deliberately does not guess ownership. All application uploads must go through StorageManager; direct dashboard/external writes bypass its limit. Database storage is separate from the object-storage allowance.
4. Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD` (at least 16 characters), `SESSION_SECRET` (at least 32), `TOKEN_ENCRYPTION_KEY` (64 random hex characters), and `RETENTION_TOKEN`. Use the same encryption key on API and worker. Back it up securely; losing it makes saved OAuth credentials unreadable.
5. Set `FRONTEND_URL` to the exact website origin, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `YOUTUBE_REDIRECT_URI` to the backend `/api/youtube/callback`. Reconnect YouTube through Settings to persist encrypted credentials in durable storage. Existing local tokens can still be read; successful token writes migrate them to encrypted state. Never put these values in Vite variables.
6. Configure Gemini/OpenRouter, stock providers and Jamendo using the existing example environment file. Provider quotas and valid licensing still apply.

## Free hosting

`render.yaml` provisions a free API service with `WORKER_ENABLED=false` and `/health`. Vercel serves `frontend`; set its project root accordingly and set `VITE_API_BASE_URL=https://YOUR-BACKEND/api` before building.

For the existing VidPilot import, both repository-root and `frontend`-root Vercel projects are supported. The root `vercel.json` installs/builds `frontend` and publishes `frontend/dist`; `frontend/vercel.json` handles frontend-root imports. The checked-in `frontend/.env.production` contains only the public API URL `https://vidpilot-ai.onrender.com/api`. A Vercel environment override takes precedence; remove an obsolete localhost override or set it to this URL. No backend secret belongs in Vercel. Production API CORS is configured for `https://vidpilotai-sigma.vercel.app`.

Frontend deployments pin npm 11.6.2 for `npm ci`, matching the lockfile generator. Tailwind's bundled WASM support dependencies are also explicitly pinned as build-only development dependencies: Linux npm validation requires their hoisted entries, which Windows lockfile generation omitted. Use the configured installer rather than bypassing the lockfile with `npm install`. Use Node 22.9+ (the project selects 22.x).

Remote dashboard access: open a signed private workspace link once in each browser. Valid sessions are remembered across tabs/browser restarts until their existing 12-hour expiry; expiration and server rejection clear both browser stores. The public URL cannot issue a local-only session. Generate a fresh link from `backend` with `node scripts/private-link.mjs https://vidpilotai-sigma.vercel.app`. Keep this link private. Dashboard access does not control whether the independent scheduler runs. Session regression checks: `node --experimental-strip-types --test frontend/scripts/workspace-session.test.mjs` from the repository root.

Rendering is not claimed to work within Render's free memory limit. The existing Windows computer has a sign-in task named `vidpilot-ai-worker`, with `WORKER_ENABLED=true`, serving http://localhost:4000. It uses temporary media directories and deletes successful publication workspaces immediately. It must remain awake for scheduled generation. To reinstall the task, run `backend/scripts/install-personal-worker.ps1`. Keep the same Supabase project and encryption key. Remotion uses signed loopback URLs on the worker configured PORT. Install matching-platform Piper, English/Hindi voices, FFmpeg, FFprobe and Chrome. Set `PIPER_EXECUTABLE_PATH`, `PIPER_ESPEAK_DATA_PATH`, `PIPER_VOICES_DIR`, `FFMPEG_PATH`, `FFPROBE_PATH`, `CHROMIUM_EXECUTABLE_PATH`; Windows binaries cannot run on Linux. Do not share local JSON mode across processes; use Supabase for split API/worker operation.

No paid service or billing change is configured. The full measured Windows runtime exceeds 500 MB. A smaller Linux native/browser distribution requires a separate measured build; it has not been proven below the limit. API-only size does not represent a complete rendering backend.

Render free services sleep and use ephemeral filesystems ([Render documentation](https://render.com/docs/free)). Keep runtime credentials in encrypted durable state and media on the worker. Set GitHub repository secrets `BACKEND_URL` (origin, without `/api`) and `RETENTION_TOKEN`, and enable `.github/workflows/retention.yml`. It calls authenticated cleanup daily at 03:23 UTC and can be dispatched manually. GitHub scheduled workflows can be delayed or disabled after inactivity; this is not an exact-time guarantee ([GitHub schedule documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)). Local media cleanup runs when the worker is available; a sleeping/offline computer cannot delete files until it returns.

## Retention

Expiration is creation + 604800000 ms. Startup, worker daily checks, post-publication cleanup and pre-upload capacity checks invoke retention. Expired new managed terminal jobs and associated owned media are removed; active/retryable jobs are protected. Shared caches are retained while active jobs may reference them. Failed deletions are recorded and retried. Compact publication records and credentials remain. YouTube videos are never deleted.

Legacy records/files are deliberately excluded from automatic retention until reviewed through reset. Ambiguous cloud upload reservations remain allocated conservatively; verify object existence and that no upload is running before manually releasing an abandoned reservation. Do not release them based only on age.

## Controlled reset

Run these commands from `backend`. Stop all workers and API writers before executing a reviewed manifest. Dry run does not delete anything:

```powershell
npm run build
npm run maintenance -- reset-old-data --manifest=../maintenance/reset-reviewed.json
```

For a local-only inventory when cloud access is unavailable:

```powershell
npm run maintenance -- reset-old-data --local-only --manifest=../maintenance/reset-local-review.json
```

The manifest backs up job records and lists paths, sizes, hashes, cloud object names and warnings. It is not a backup of media bytes; copy any media you want to retain separately. Unknown folders are left untouched. Review the complete manifest before confirming. The command validates paths, symlinks, file hashes and job update timestamps again before deletion.

Only after explicit confirmation:

```powershell
$env:MAINTENANCE_MODE='true'
npm run maintenance -- reset-old-data --execute --manifest=../maintenance/reset-reviewed.json --confirm=DELETE_OLD_VIDPILOT_DATA
Remove-Item Env:MAINTENANCE_MODE
```

Do not execute the local-only manifest expecting cloud history to reset. The operation preserves published video identifiers, secrets, schema and settings. On 14 October, the user-authorized local reset removed 28 historical local records and 441 historical media files (2,160,315,384 bytes). Separate test/download artifacts were also removed. Historical cloud records and objects were preserved: a cloud reset still requires explicit confirmation and a freshly generated manifest. Previously executed manifests are audit evidence, not reusable deletion instructions.

Manual retention: `npm run maintenance -- cleanup`.

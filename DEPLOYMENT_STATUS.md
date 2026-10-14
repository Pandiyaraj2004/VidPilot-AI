# Deployment verification — 14 October 2026

## Live services

- Frontend: https://vidpilotai-sigma.vercel.app
- Vercel project: `vidpilot_ai`, team `pandiyarajs-projects-4cc18b9f`, Hobby plan.
- Verified production deployment: `dpl_CMrCVj13wtGkTh9rnU9XJ2i9ahky`, commit `e5590fd`, state READY, production alias assigned.
- Backend: https://vidpilot-ai.onrender.com
- Render service: `srv-d9uoh83ncjis73a4ta40`, aavp's workspace, Free plan.
- Verified Render deployment: `dep-db7qoglg1s2s73bh5n8g`, commit `1ce9e80`, state live. This includes the backend security lockfile fixes from `349061d`.

No paid plan, disk, worker, database or billing change was activated. Existing services were reused.

## Fixes and verification

The initial Vercel deployment came from the empty `Pandiyaraj2004/vidpilot_ai` starter repository. Production was explicitly deployed from the existing `Pandiyaraj2004/VidPilot-AI` repository instead. The Vite root is `frontend`, output `dist`, Node 22.x. Root imports also have a Vercel configuration. `VITE_API_BASE_URL` is the public Render API URL. Backend credentials were copied to the existing Render service only after explicit user approval; none were placed in Vercel or committed.

Linux npm ci exposed missing hoisted Tailwind WASM support dependencies. These are now explicitly pinned as build-only dependencies, with npm 11.6.2 used for reproducible frontend CI. Vercel's real Linux production build passed after the fix.

Compatible dependency updates resolved the initial 17 backend advisories. Backend and frontend npm audits reported zero vulnerabilities at update time. Backend TypeScript checking/build and all **473 backend tests** passed after the backend updates. Frontend lint and TypeScript/production build passed after the frontend updates. GitHub's backend build for `349061d` passed.

Live checks returned:

- `/health`: HTTP 200, ready true.
- Authenticated `/api/workspace`: HTTP 200, shared durable data readable.
- `/api/youtube/status`: HTTP 200, connected true, no connection error.
- Unauthenticated `/api/workspace`: HTTP 401.
- CORS allows exactly the configured production frontend; an unrelated origin received no allow-origin header.
- Supabase object usage: 216,976,911 bytes; reserved 0; limit 500,000,000; warning false.
- Worker online, idle, automatic scheduling enabled. Existing four-hour schedule and 30–45-second automatic duration configuration were preserved. The manual quick-generation path remains 50–60 seconds.

Browser verification of the authenticated production page showed live history including the published Interest Rates Explained video, its category/language/voice/style/duration, storage, schedule, enabled Generate & Upload Now button, and connected YouTube settings with Public visibility. The narrow browser viewport was visually inspected. No new production job or upload was triggered merely to test deployment, and no history was deleted.

## Access and limits

There is no application login page. Remote access requires the existing signed private workspace link, which expires after 12 hours. A fresh link is saved in the ignored local `maintenance/production-workspace-link.txt`; treat it like a password. Regenerate from backend with:

```powershell
node scripts/private-link.mjs https://vidpilotai-sigma.vercel.app
```

Render runs API-only (`WORKER_ENABLED=false`), using shared Supabase state and the same encryption/session keys as the existing PC worker. Rendering and scheduled generation still require that PC awake and connected. Free Render sleeps when idle; always-on cloud rendering has not been established within its free limits. Current YouTube credentials work; future cloud OAuth reconnection requires the Render callback URL to be registered in Google OAuth settings.

## Future automatic website deployments

The Vercel project's stored Git integration still points to the starter `Pandiyaraj2004/vidpilot_ai` repository. The live production deployment is from the correct `VidPilot-AI` repository, but future pushes to it are not yet proven to trigger Vercel automatically. In Vercel Project Settings → Git, replace the connected repository with `Pandiyaraj2004/VidPilot-AI`, production branch `main`, retaining root `frontend`. The connector cannot relink an existing project's Git repository; the browser settings page requires Vercel sign-in. Existing application scheduling is independent of this website build integration.

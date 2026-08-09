# VidPilot AI

A personal, single-user AI video production and YouTube publishing workspace. Give it a topic, and (in later phases) it plans, writes, voices, renders, quality-checks, sends the result to Telegram for your approval, and publishes to YouTube — then tracks performance to inform the next topic.

This is **Phase 1**: project foundation, architecture, and a fully navigable dashboard. No AI, voice, rendering, Telegram, or YouTube integration is wired up yet — this phase exists so those integrations can be added later without restructuring the app.

## Features (Phase 1)

- Full application shell: collapsible desktop sidebar, mobile drawer navigation, top bar
- 8 routed pages: Dashboard, Create Video, Video Queue, Published Videos, Analytics, Scheduler, Telegram, Settings
- Dark / Light / System theme, persisted locally, no flash-on-load
- Reusable UI component library (buttons, forms, cards, tables, dialogs, toasts, skeletons, empty/error states)
- TypeScript domain models for the entire future pipeline (jobs, scenes, scheduler config, analytics, system status)
- Service-layer interfaces for every future integration (AI content engine, voice, renderer, Telegram, YouTube, analytics, scheduler) — all throw a clear "ships in Phase N" error rather than pretending to work
- A localStorage-backed config abstraction for Scheduler/Settings forms, designed to be swapped for Firestore later without touching callers
- Express + TypeScript backend skeleton with the same service-placeholder structure and a real `/api/status` endpoint
- No fabricated data anywhere — every stat, table, and chart shows an honest empty state until the real integration exists

## Architecture

```
Topic → AI Content Engine → Voice (Piper) → Renderer (Remotion+FFmpeg) → Quality Check
      → Telegram Approval → YouTube Upload → Analytics → AI Insights → next topic
```

Phase 1 builds the frame around this pipeline, not the pipeline itself. The frontend never calls an AI provider, Telegram, or YouTube directly — it goes through a service interface (`src/services/*`) so a future phase can implement the real thing behind the same contract.

Key architectural decisions carried through the whole project:
- **Human approval before publish.** Every generated video is gated by a Telegram approve/reject step before it reaches YouTube — this is a permanent design decision, not a Phase 1 stand-in.
- **Provider-agnostic AI layer.** UI and job orchestration code depend on a `ContentEngine`/`contentEngine` interface, never a specific vendor (Gemini/OpenRouter are implementation details behind it).
- **Content variation over detection-evasion.** The system is designed around genuinely varied structures (documentary, mystery, Q&A, listicle, etc.) and honest synthetic-media disclosure, not around making AI output look undetectable — this matches YouTube's monetization policy, which penalizes repetitive/templated content rather than AI-assisted content per se.
- **Config is swappable.** Anything persisted in Phase 1 (Scheduler/Settings) goes through a small `ConfigStore` interface backed by `localStorage` today and Firestore later.

## Tech Stack

**Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, React Router v7, Lucide icons, oxlint
**Backend:** Node.js, TypeScript, Express (skeleton only — no business logic yet)
**Database (prepared, not implemented):** Firebase Firestore
**Planned integrations (later phases):** Gemini / OpenRouter, Piper TTS, Remotion + FFmpeg, Telegram Bot API, YouTube Data API + Analytics API

## Folder Structure

```
vidpilot/
├── frontend/
│   ├── src/
│   │   ├── components/{ui,layout,dashboard,common}/   reusable UI, app shell, dashboard widgets
│   │   ├── pages/{Dashboard,CreateVideo,VideoQueue,PublishedVideos,Analytics,Scheduler,Telegram,Settings}/
│   │   ├── services/{ai,voice,renderer,telegram,youtube,analytics,scheduler,storage,settings,firebase,api}/
│   │   ├── context/        Theme + Toast providers (context object split from provider for Fast Refresh)
│   │   ├── hooks/          useTheme, useToast, useMediaQuery
│   │   ├── types/          VideoJob, Scene, SchedulerConfig, AnalyticsSummary, SystemStatus, ...
│   │   ├── constants/      route paths, nav items
│   │   ├── routes/         React Router config (route-level code splitting via `lazy`)
│   │   └── utils/
│   └── package.json
│
├── backend/
│   ├── src/
│   │   ├── config/         env loader (secrets never leave this layer)
│   │   ├── controllers/, routes/, middleware/
│   │   ├── services/{ai,voice,renderer,telegram,youtube,analytics,scheduler,storage,firebase}/
│   │   └── server.ts
│   └── package.json
│
├── .env.example             consolidated reference of every env var used across the project
└── package.json             convenience scripts (npm --prefix frontend/backend)
```

`frontend/.env.example` and `backend/.env.example` are the ones that actually get read (Vite/dotenv look for `.env` in their own working directory) — the root `.env.example` is a single reference copy of both.

## Installation

```bash
git clone <this-repo>
cd vidpilot

# Frontend
cd frontend
npm install
cp .env.example .env.local   # optional in Phase 1 — nothing requires it yet

# Backend
cd ../backend
npm install
cp .env.example .env         # optional in Phase 1 — nothing requires it yet
```

## Development Commands

```bash
# Frontend — from frontend/
npm run dev         # start Vite dev server → http://localhost:5173
npm run build       # typecheck + production build → frontend/dist
npm run lint        # oxlint
npm run preview     # preview the production build locally

# Backend — from backend/
npm run dev         # start with tsx watch → http://localhost:4000
npm run build       # tsc → backend/dist
npm run start       # run the compiled server
npm run typecheck   # tsc --noEmit
```

The frontend and backend are independent Node projects (separate `node_modules`/lockfiles) and can be developed and deployed separately. The frontend does not currently call the backend for anything — the `/api/status` endpoint exists as prepared architecture but isn't wired into the UI until a later phase needs it.

## Environment Variables

See `.env.example` (root), `frontend/.env.example`, and `backend/.env.example`.

**Rule: anything prefixed `VITE_` is bundled into the browser.** Never put a private key, token, or secret behind a `VITE_` variable. Firebase's client-side web config (`VITE_FIREBASE_*`) is the one exception — it's not a secret by design. Gemini/OpenRouter keys, the Telegram bot token, Google OAuth client secret, and the YouTube refresh token are backend-only (`backend/.env`) and are never read by the frontend.

None of these are required to run Phase 1 — the app works fully with no `.env` file present, showing "Not configured" everywhere an integration would eventually plug in.

## Phase 1 Scope

**Implemented:** application shell, routing, theming, the full reusable component library, TypeScript domain models, service-layer interfaces/placeholders for every future integration, a localStorage config abstraction for Scheduler/Settings, a backend skeleton with one real endpoint (`/api/status`), responsive layout (desktop sidebar / mobile drawer), accessibility basics (focus states, ARIA labels, status never conveyed by color alone, `prefers-reduced-motion` respected), and honest empty states everywhere real data doesn't exist yet.

**Explicitly not implemented yet** (by design — see the phase plan below):
- ❌ Gemini / OpenRouter API calls
- ❌ Script/scene generation
- ❌ Piper voice synthesis
- ❌ Remotion / FFmpeg rendering
- ❌ Telegram bot / approval flow
- ❌ YouTube OAuth / upload / Analytics API
- ❌ Automatic scheduling (the Scheduler page saves config only; nothing runs on a timer yet)
- ❌ AI performance insights
- ❌ Cartoon engine

Clicking "Generate Video" on the Create Video page calls the real `contentEngine.generate()` service function, which throws a clear "ships in Phase 3" error — shown to the user as a toast. This proves the service architecture works end-to-end without pretending generation is live.

## Future Phases

| Phase | Scope |
|---|---|
| 2 | AI Content Engine (Gemini primary, OpenRouter fallback), structured scene JSON, content-variation engine, similarity checking against prior videos |
| 3 | Script quality/critic scoring pass |
| 4 | Piper voice synthesis with measured (not estimated) audio duration |
| 5 | Remotion + FFmpeg rendering pipeline → first playable MP4 |
| 6 | Quality Control engine (technical/audio/content/metadata scoring) |
| 7 | Telegram bot approval gateway |
| 8 | YouTube OAuth, upload (defaults to Private), synthetic-media disclosure |
| 9 | Elapsed-time automation scheduler |
| 10 | Full automation loop (MVP complete) |
| 11 | YouTube Analytics integration |
| 12 | AI performance insights / topic recommendations |
| 13 | Cartoon engine (character/pose/background system) |
| 14 | Advanced content pipeline (research → outline → script → critic → rewrite) |

Do not implement later phases ahead of schedule — each one builds on a working, tested version of the last.

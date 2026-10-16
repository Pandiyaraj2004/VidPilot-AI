# VidPilot AI

> A video-generation workflow connecting scripts, narration, visuals, rendering, quality checks, and YouTube publishing.

**React · TypeScript · Express · Remotion · FFmpeg · AI APIs**

## At a glance

- A staged media pipeline with persistent job handling.
- Quality checks before publication, bounded retries, and publication reconciliation.
- Separate frontend and backend packages with typecheck and build commands.

## Explore the implementation

| Start here | What to inspect |
| --- | --- |
| [backend/src/services/jobs](backend/src/services/jobs) | Job orchestration |
| [backend/src/services/quality](backend/src/services/quality) | Quality checks |
| [backend/src/services/ai](backend/src/services/ai) | Content generation |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Setup and deployment |
| [IMPLEMENTATION_REPORT.md](IMPLEMENTATION_REPORT.md) | Recorded validation and remaining limits |

---

## Detailed guide

Personal video generation and YouTube publishing, using the existing React/TypeScript/Vite frontend and Express/TypeScript backend.

Topic → Script → Narration → Visuals & Music → Captions → Render → Quality Check → YouTube Upload.

Only a QC **PASS** may publish. WARN and FAIL remain unpublished. Jobs have at most three automatic attempts. Durable publication intents prevent automatic duplicate uploads; uncertain outcomes require reconciliation, never blind re-upload.

Gemini and free OpenRouter models generate validated scripts. Piper handles English/Hindi; Edge TTS handles Tamil. Existing licensed stock sourcing, music, captions, Remotion, Chrome, FFmpeg and FFprobe remain. The one-page dashboard opens without a login page on the local computer; backend API access remains protected.

See [DEPLOYMENT.md](DEPLOYMENT.md) for setup, retention scheduling, database migration and reset commands. See [IMPLEMENTATION_REPORT.md](IMPLEMENTATION_REPORT.md) for measured results and remaining limits. Cloud rendering deployment and browser visual review remain unverified.

## Development

Use Node 22 or newer. In each of `backend` and `frontend`, run `npm ci`. Configure backend secrets using `backend/.env.example`. Set frontend `VITE_API_BASE_URL=http://localhost:4000/api`. Run `npm run dev` in each directory. Keep credentials out of frontend variables.

Backend checks: `npm run typecheck`, `npm test`, `npm run build`, `npm run size`. Frontend checks: `npx tsc -b`, `npm run lint`, `npm run build`.

The backend uses committed precompiled `dist` for the existing Render deployment strategy. Rebuild it before deploying. Never deploy generated storage, local credentials, test fixtures or platform-incompatible binaries.

Use **Generate & Upload Now** for one additional 50–60-second cinematic Short. It follows saved publishing visibility, uses the same QC-gated persistent queue, and does not update the next scheduled run. Repeated requests reuse an active manual job. Scheduled duration settings remain unchanged. Neural voices use natural scene-level synthesis, with bounded retries for provider outages. Install production dependencies normally so the checked-in Edge client compatibility patch runs during postinstall.

---

Built by **Pandiyaraj A** · [Portfolio](https://pandiyaraj.netlify.app/) · [GitHub](https://github.com/Pandiyaraj2004) · [LinkedIn](https://www.linkedin.com/in/pandiyaraj-a-mca/)

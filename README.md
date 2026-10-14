# vidpilot ai

Personal video generation and YouTube publishing, using the existing React/TypeScript/Vite frontend and Express/TypeScript backend.

Topic → Script → Narration → Visuals & Music → Captions → Render → Quality Check → YouTube Upload.

Only a QC **PASS** may publish. WARN and FAIL remain unpublished. Jobs have at most three automatic attempts. Durable publication intents prevent automatic duplicate uploads; uncertain outcomes require reconciliation, never blind re-upload.

Gemini and free OpenRouter models generate validated scripts. Piper handles English/Hindi; Edge TTS handles Tamil. Existing licensed stock sourcing, music, captions, Remotion, Chrome, FFmpeg and FFprobe remain. The one-page dashboard opens without a login page on the local computer; backend API access remains protected.

Open http://localhost:4000. The installed Windows worker starts at sign-in and processes the existing four-hour schedule while the computer is awake. Generated media uses temporary storage and is removed after successful publication. The approved Unlisted test was uploaded and independently verified through YouTube: https://www.youtube.com/watch?v=Q5XIAU9BQcs.

See [DEPLOYMENT.md](DEPLOYMENT.md) for setup, retention scheduling, database migration and reset commands. See [IMPLEMENTATION_REPORT.md](IMPLEMENTATION_REPORT.md) for measured results and remaining limits. Cloud rendering deployment and browser visual review remain unverified.

## Development

Use Node 22 or newer. In each of `backend` and `frontend`, run `npm ci`. Configure backend secrets using `backend/.env.example`. Set frontend `VITE_API_BASE_URL=http://localhost:4000/api`. Run `npm run dev` in each directory. Keep credentials out of frontend variables.

Backend checks: `npm run typecheck`, `npm test`, `npm run build`, `npm run size`. Frontend checks: `npx tsc -b`, `npm run lint`, `npm run build`.

The backend uses committed precompiled `dist` for the existing Render deployment strategy. Rebuild it before deploying. Never deploy generated storage, local credentials, test fixtures or platform-incompatible binaries.

# VidPilot AI — Master Plan

This is the standalone planning reference for VidPilot AI: the product vision, the operating principles that constrain every phase, and the full 15-phase roadmap. `README.md` describes what's *built and working right now*; this document describes what the whole project is *for* and where it's headed. When the two disagree about a future phase, this file is the source of truth for intent — `README.md` is the source of truth for current state.

## Vision

VidPilot AI is a **personal, single-user** video production and YouTube publishing workspace. One person gives it a topic; it plans, writes, voices, visualizes, subtitles, renders, quality-checks, and (with human approval) publishes a real video — then watches how that video performs to inform the next topic. The end state is a loop that runs mostly on its own, with a human in it only where a human's judgment genuinely matters: approving what gets published.

It is explicitly **not** a multi-tenant SaaS product, not a content farm, and not built around any specific "growth hack." It is one person's automation of their own channel.

## The correction that shapes everything downstream

Early in this project's planning, the framing shifted deliberately, and every phase since has been built to honor that shift:

> Don't design the system around "making AI videos that YouTube cannot detect as AI." Instead, design it around **original, useful, materially varied content with the appropriate synthetic-content disclosure.**

Concretely, this means:
- Visual variety exists to make videos genuinely *look different from each other* — a real production-quality concern — not to evade any detection system.
- The YouTube upload phase (Phase 11) includes synthetic-media disclosure as a first-class step, not an afterthought.
- Script generation optimizes for being *actually informative and well-structured*, not for statistical mimicry of "human-sounding" text.
- No phase of this plan includes anti-detection techniques, watermark stripping, or metadata spoofing, and none should be added later.

## Design Principles for Video Quality

The final video must **not** be a boring single-background + static text + voice. It must produce attractive, content-related videos with:

- Different visuals for different scenes — related directly to the narration content
- Fast/slow pacing based on content type and emotional beat
- Camera movement, zoom/pan effects, parallax
- Scene transitions (cross-fade, cut, push, zoom-burst, etc.)
- Dynamic captions with word-emphasis and motion
- Background music and sound effects where appropriate
- Content-specific emotion and expressive voice delivery
- Male and female voices where the selected language/provider supports it
- English, Hindi, and Tamil voice support
- Different visual structures for GK, motivation, science, history, mystery, etc.

**Optimize for viewer engagement and retention** through relevant visuals, storytelling, pacing, curiosity, emotion, and variety — not for meaningless movement:

- Motivation → energetic/powerful delivery and visuals
- GK → curiosity/surprise and rapidly changing relevant visuals
- Mystery → suspense, pauses, darker/cinematic visuals
- Science → informative/exciting visuals, diagrams and animations
- History → storytelling/cinematic visuals

## Operating principles (apply to every phase)

1. **Backend-mediated architecture.** The frontend never talks directly to Firestore, an AI provider, Piper, Edge TTS, ffmpeg, or any integration. Everything goes through the backend's REST API.
2. **No secrets reach the browser.** Only Firebase's public web config (not a secret by design) is ever in client-bundled code. API keys, service account JSON, and OAuth secrets are backend-only.
3. **Real measurements, never estimates, once a real one is available.** Scene duration comes from actual audio headers. Video duration/resolution/codec come from `ffprobe` on the actual rendered file.
4. **No fabricated progress.** If the backend can't report real per-item progress, the UI says "generating…" honestly rather than showing a meaningless progress bar.
5. **Partial failure never destroys prior success.** One scene's failure doesn't discard other scenes' completed work. A retry re-does only what's actually broken.
6. **Local/self-hosted before paid API, always evaluate honestly first.** When a genuinely local option doesn't exist (Tamil TTS), the honest result — including failures — is documented, never silently swapped for an invented capability.
7. **Human approval gates publishing.** Nothing uploads to YouTube without an explicit Telegram approval step (Phase 10).
8. **Never skip a state in the job state machine.** Every pipeline stage sets a real, distinct `JobStatus` value in sequence.
9. **Storage discipline: workspace vs. record.** Generated binaries live under `backend/storage/`. The database stores only metadata — never the binary itself.
10. **Provider abstraction everywhere an external dependency exists.** Swapping or adding a provider is implementing the interface, not restructuring the caller.

## Architecture (target state)

```
Topic + Settings
  → AI Content Engine          (script, structured scenes, style-aware prompting)
  → Dynamic Visual Engine       (scene-specific content-related visuals, templates)
  → Advanced Voice Engine       (expressive delivery, emotion, male+female, EN/HI/TA)
  → Subtitle & Motion Graphics  (word emphasis, animated captions, kinetic text)
  → Video Composition           (camera movement, zoom/pan, transitions, music, SFX)
  → Quality Control             (technical + audio + content + metadata scoring)
  → Telegram Approval           (human watches, approves or rejects)
  → YouTube Upload              (with synthetic-media disclosure, Private default)
  → Automation Scheduler        (elapsed-time loop, no manual trigger needed)
  → YouTube Analytics           (real view/watch-time/retention data)
  → AI Performance Insights     (what worked, informs next topic/style)
  → back to Topic               (next job, informed by the last one's real performance)
```

Every arrow above is a real, working call as of the phase that implements it — never a stub.

## Phase-by-phase plan

| Phase | Scope | Status |
|---|---|---|
| 1 | **Foundation** — architecture, routing, theming, reusable UI component library, responsive layout | ✅ Shipped |
| 2 | **Job System** — Create Video form, job persistence (Firestore + local-JSON fallback), Video Queue, Job Details, cancel/retry, Dashboard | ✅ Shipped |
| 3 | **AI Content Engine** — real script generation (Gemini + OpenRouter fallback), schema-validated structured scenes, style/duration/language-aware prompting, repetition guard, regeneration | ✅ Shipped |
| 4 | **Voice Engine** — Piper TTS (EN/HI, self-hosted), Edge TTS (Tamil, free network), real measured duration, audio validation, partial-failure-safe per-scene retry | ✅ Shipped |
| 5 | **Dynamic Visual + Scene Engine** — scene-specific visuals tied to narration content; content-style-to-visual mapping (motivation→energetic, mystery→cinematic, GK→curious, etc.); local deterministic templates as MVP foundation; provider seam for future AI-image providers | ✅ Shipped |
| 6 | **Advanced Audio + Expressive Voice** — emotion/pacing-aware voice delivery; prosody control where provider supports it; additional Piper voice models (EN male, HI male); background music (royalty-free, genre-matched); scene-level sound effects; audio normalization before render | ✅ Shipped (except EN/HI male voices) |
| 7 | **Subtitle & Motion Graphics Engine** — animated captions (word-by-word reveal, kinetic text); important-word emphasis (bold/color highlight, scale pop); style-appropriate animation (fast-paced for GK, slow-burn for mystery); caption positioning and safe-zone awareness | ✅ Shipped |
| 8 | **Video Composition + Rendering** — scene transitions (cross-fade, cut, push, zoom-burst); camera movement simulation (zoom/pan/parallax on still visuals); pacing control based on content style; Remotion upgraded from single static scene to full multi-scene timeline; music mix and mastered audio in final render | ✅ Shipped |
| 9 | **Quality Control Engine** — technical scoring (resolution/codec/duration sanity), audio scoring (loudness/silence/clipping), content scoring (does video match script intent), metadata scoring (title/description/tags completeness); must pass all checks before Telegram approval | ✅ Shipped |
| 10 | **Telegram Approval** — bot sends video + metadata to Telegram; human watches on phone, approves or rejects with optional rejection reason; rejection reason feeds back into regeneration | ✅ Shipped |
| 11 | **YouTube Integration** — real Google OAuth2 (`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`), a real `videos.insert` upload gated on QC-PASS + Telegram-approved + connected channel, mandatory synthetic-media disclosure on every upload, duplicate-upload protection | ✅ Shipped |
| 12 | **Automation Scheduler** — elapsed-time scheduler (compares `now >= nextGenerationAt`, not a fixed cron); full pipeline triggered automatically; manual "Create Video" still works alongside it | ⏳ Planned |
| 13 | **YouTube Analytics** — real view/watch-time/retention/CTR data pulled per published video from YouTube Analytics API; data stored on the job record; displayed on the Analytics page | ⏳ Planned |
| 14 | **AI Performance Intelligence** — use real Analytics data (not guesses) to surface which topics/styles/templates/voices/lengths are working; AI-generated recommendations for next topic and production choices | ⏳ Planned |
| 15 | **Cartoon / Advanced Animation** — fuller character, pose, and background system building on Phase 5's lightweight `cartoon` template; style-specific illustrated scenes; character consistency across scenes | ⏳ Planned |

## Where the codebase stands against the new phase map

| Phase | What exists today |
|---|---|
| 1 Foundation | ✅ Complete |
| 2 Job System | ✅ Complete — now also carries the job-level `contentCategory` (13 categories) that drives AI prompting and music selection |
| 3 AI Content Engine | ✅ Complete — prompting is now content-category-aware (tone/pacing hints per category), scenes carry `visualKeywords`/emotion/energy/`sceneRole` used by the visual and voice engines |
| 4 Voice Engine | ✅ Complete — EN female + HI female (Piper); TA female + male (Edge TTS). No EN/HI male voice yet. Delivery is now emotion-aware (see Phase 6). |
| **5 Dynamic Visual + Scene Engine** | ✅ **Complete** — real internet sourcing (Pixabay Videos → Pexels Videos → Pixabay Images → Wikimedia Images → deterministic procedural fallback), per-asset license verification before use, content-matched query building from the AI's own `visualKeywords`, multiple energy-dependent short clips per scene with real Ken Burns motion and transitions between them. The old gradient-only MVP is now the offline/no-API-key fallback path, not the primary path. |
| **6 Advanced Audio + Expressive Voice** | ✅ **Complete** — voice-direction system maps AI-assigned emotion to real pace/pitch/pause per scene; sentence-level synthesis with genuine inserted silence between sentences; trim/normalize/limiter/fade audio processing; extended validation (clipping, unexplained internal silence). Music: **Jamendo** (real API, per-track CC BY/BY-SA license verification) as primary source with a manually-curated local library as automatic fallback; local SFX library triggered by real scene-role signals (hook→whoosh, reveal→impact); real ffmpeg sidechain ducking (narration always primary); full attribution metadata (title/artist/source/license) recorded per scene. Still missing: EN/HI male voices. |
| **7 Subtitle & Motion Graphics** | ✅ **Complete** — real safe-zone layout system (fractional positions, not fixed pixels, so it's correct at any aspect ratio), real Chrome `canvas.measureText()`-based wrapping/font-fitting (never an estimate), color-highlighted word emphasis, hook/title and subtitle captions confined to separate never-overlapping regions, **word-by-word kinetic reveal** with real per-cue timing (`wordTiming.ts`) and **emotion/energy-driven emphasis scale-pop** (`captionPacing.ts`), deterministic fallback highlight-word selection when the AI gives none. |
| **8 Video Composition + Rendering** | ✅ **Complete** — real motion (pan/zoom) and real transitions between a scene's own visual clips, energy-based pacing, licensed background music mixed with real dynamic ducking, config-driven 9:16 (default) / 16:9 output, **and real cross-*scene* transitions** (`sceneTransitionPlanner.ts`/`sceneTransitionConcat.ts` — content-category/emotion-aware selection, real ffmpeg `xfade`/`acrossfade` execution, repetition guard, motion continuity across boundaries). |
| **9 Quality Control** | ✅ **Complete** — 8 real validators (video/audio/captions/visuals/sync/metadata/content/license) against the job's actual rendered file and content, transparent weighted scoring, PASS/WARN/FAIL with a severity model where any CRITICAL issue or category FAIL forces overall FAIL. Verified via the live API against real Phase 8 videos (PASS 100, and a WARN 94 that caught a genuine defect — a highlight word not appearing in its scene's narration). |
| **10 Telegram Approval** | ✅ **Complete** — real `TelegramBotProvider` (plain `fetch`, no SDK), real video+caption+button delivery, real reject-with-reason (quick button or free-text reply) and approve flow, approval-version security model so a stale message can never approve a newer render, long-poll transport live today + a real webhook route for production. Verified with a real Telegram account: real send → real reject with a real reason → guard-blocked resend of the rejected job → real resend → real approve, plus a stale-version guard demonstrated against real state transitions. |
| **11 YouTube Integration** | ✅ **Complete, verified live** — real Google OAuth2 via `googleapis` (connect/disconnect/channel lookup all real, browser-navigated consent flow), real `videos.insert`/`thumbnails.set` upload, strict backend-only gating (approval status + render-version match + QC-PASS-only + connected-channel check, none trusted from the client), pre-upload re-validation of the actual rendered file, duplicate-upload protection, classified error handling. Unit-tested against a `FakeYouTubeProvider`. **Live-verified end to end**: real Google OAuth consent (account `curiomentra@gmail.com`, added as a Testing-mode test user — two real setup snags hit and fixed live: a `redirect_uri_mismatch` from an unregistered redirect URI, and a `403 access_denied` from the OAuth consent screen's Testing-mode allowlist), real connected channel "CurioMentra" (`UCoHAIrMxm856qPPcbe_UqcA`), a real QC-PASS (100/100) job real-approved on Telegram, a real `videos.insert` call producing real video id `pQI4b6tN-1w` at `https://www.youtube.com/watch?v=pQI4b6tN-1w`, privacy `public` — independently confirmed via YouTube's own public oEmbed API (title + channel match) and via the app's own UI showing "Published" after a refresh. |
| 12 Automation Scheduler | ❌ Placeholder stub only — localStorage-only frontend config |
| 13 YouTube Analytics | ❌ Not started |
| 14 AI Performance Intelligence | ❌ Not started |
| 15 Cartoon / Advanced Animation | ❌ Lightweight SVG-only cartoon in the Phase 5 MVP fallback path; full system not started |

## Language support commitment

**Tamil is a mandatory, permanent supported language for VidPilot.** It must never be silently dropped or permanently marked unsupported at any layer (script generation, voice, visuals, subtitles, rendering, and eventually upload metadata) — the fix is always to find or build the right provider for that stage, never to remove the language.

## Master document changelog

- **After Phase 4 (original Phase 5):** Created this document. Full plan consolidated from conversation history. Shipped as "Phase 5" covering Visual Engine + Subtitle Engine + Video Rendering Engine + Tamil voice.
- **Phase restructuring (2026-08-10):** Roadmap expanded from 14 to **15 phases**. The original single Phase 5 (which shipped only MVP implementations of visuals, subtitles, and rendering) is now properly split into four dedicated phases: **5** Dynamic Visual + Scene Engine, **6** Advanced Audio + Expressive Voice, **7** Subtitle & Motion Graphics Engine, **8** Video Composition + Rendering. The former Phases 6–14 renumber to 9–15 accordingly. Added Design Principles for Video Quality section capturing the engagement-over-movement philosophy and content-style-specific guidance.
- **Phase 5 + 6 shipped, 7 + 8 mostly shipped (2026-08-10, later same day):** Phase 5 went from MVP gradients to real internet visual sourcing (Pixabay/Pexels/Wikimedia, license-verified, content-matched, multi-clip motion/transitions). Phase 6 shipped in full except EN/HI male voices: voice-direction system, sentence-level synthesis with real pauses, and a real music/SFX engine (Jamendo primary + local fallback, real ducking, full attribution metadata). Phase 7's safe-zone layout and real text measurement shipped; word-by-word kinetic caption reveal did not. Phase 8's in-scene motion/transitions and licensed music mixing shipped; cross-*scene* transitions remain a hard cut. Output default switched to vertical 9:16 Shorts (1080×1920), landscape still available via config. Along the way, found and fixed three real bugs via real generated-output inspection (not just passing tests): a caption word-spacing collapse, background music being silently absent from every render (ffmpeg `sidechaincompress` inputs were swapped), and Jamendo's `fuzzytags` search parameter behaving as AND instead of OR. See `README.md` for full current-state detail.
- **Phases 7–10 fully shipped (2026-08-11):** Phase 7's remaining gap (word-by-word kinetic caption reveal + emotion-driven emphasis scale-pop) closed, using real per-cue timing rather than a fixed per-word duration. Phase 8's remaining gap (cross-*scene* transitions) closed with real content-category/emotion-aware transition selection and real ffmpeg `xfade`/`acrossfade` execution. Phase 9 (Quality Control) built from scratch: 8 real validators, transparent weighted scoring, verified via the live API against real rendered videos (one clean PASS, one WARN that caught a genuine defect). Phase 10 (Telegram Approval) built from scratch: real Bot API integration, approval-version security model, verified with a real Telegram account through a full send → reject → resend → approve cycle. Five more real bugs found and fixed via real end-to-end use (not just tests): an ffmpeg `xfade` timebase mismatch only reproducible against genuine Remotion output, a false assumption about what ffmpeg's `astats` "Peak count" actually measures, a video-playback regression where QC's own status transitions broke the video player, a Telegram chat id that turned out to be the bot's own id, and a Telegram callback handler with no top-level error handling that left a tapped button stuck spinning on an unexpected failure. Test suite grew from 366 to 432 tests (50 files). See `README.md` for full current-state detail.
- **Phase 11 (YouTube Upload) shipped (2026-08-11, later same day):** Found on inspection that OAuth connect/disconnect, real channel lookup, category mapping, and upload-metadata building already existed from earlier work — this doc and README previously (incorrectly) described YouTube as an unstarted placeholder. Built the missing piece: `jobService.uploadVideoForJob`, gated strictly on the job's own durable records (approval approved-and-current-render, quality report a real PASS, connected channel — never trusted from the client), re-validating the actual rendered file immediately before the real `videos.insert` call, with duplicate-upload protection and thumbnail-upload isolation. Added the REST endpoint, fixed the frontend's stale Phase-8-era placeholder service, and built the Settings connection card and Job Details Publish card. 13 new unit tests against a `FakeYouTubeProvider`; real live verification against a genuine Google account is the next step. See README's Testing section for that result.

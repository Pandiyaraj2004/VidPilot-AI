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
| 12 | **Automation Scheduler** — elapsed-time scheduler (compares `now >= nextGenerationAt`, not a fixed cron); full pipeline triggered automatically; manual "Create Video" still works alongside it | ✅ Shipped |
| 13 | **YouTube Analytics** — real view/watch-time/retention/CTR data pulled per published video from YouTube Analytics API; data stored on the job record; displayed on the Analytics page | ⏳ Planned |
| 14 | **AI Performance Intelligence** — use real Analytics data (not guesses) to surface which topics/styles/templates/voices/lengths are working; AI-generated recommendations for next topic and production choices | ⏳ Planned |
| 15 | **Cartoon / Advanced Animation** — fuller character, pose, and background system building on Phase 5's lightweight `cartoon` template; style-specific illustrated scenes; character consistency across scenes | ⏳ Planned |

## Where the codebase stands against the new phase map

| Phase | What exists today |
|---|---|
| 1 Foundation | ✅ Complete |
| 2 Job System | ✅ Complete — now also carries the job-level `contentCategory` (13 categories) that drives AI prompting and music selection |
| 3 AI Content Engine | ✅ Complete — prompting is now content-category-aware (tone/pacing hints per category), scenes carry `visualKeywords`/emotion/energy/`sceneRole` used by the visual and voice engines |
| 4 Voice Engine | ✅ Complete — EN female + HI female (Piper); TA female + male (Edge TTS). Delivery is emotion-aware. Added Microsoft Edge Neural voices for high-quality English & Hindi speech. |
| 5 Dynamic Visual + Scene Engine | ✅ Complete — real internet sourcing (Pixabay Videos → Pexels Videos → Pixabay Images → Wikimedia Images → deterministic procedural fallback), per-asset license verification before use. Ken Burns motion and clip transitions. |
| 6 Advanced Audio + Expressive Voice | ✅ Complete — voice-direction system maps AI-assigned emotion to real pace/pitch/pause; music from Jamendo API and local fallback with sidechain ducking; sound effects from local library. |
| 7 Subtitle & Motion Graphics | ✅ Complete — safe-zone layout, font fitting, colored word highlights, word-by-word kinetic subtitle reveal with spring bounce zoom. |
| 8 Video Composition + Rendering | ✅ Complete — pan/zoom motion, clip transitions, background music mixed with ducking, dynamic cross-scene transition selection, and ffmpeg xfade processing. |
| 9 Quality Control | ✅ Complete — 8 validators (video, audio, subtitles, visuals, sync, metadata, content, licenses) produce a weighted QC score (score >= 70 = PASS). |
| 10 Telegram Approval | ✅ Complete — long-poll/webhook Telegram bot delivers video + metadata + buttons for phone approval/rejection. |
| 11 YouTube Integration | ✅ Complete — Google OAuth2 authentication flow, uploads to YouTube with synthetic media disclosures, duplicate check, and thumbnail updates. |
| **12 Automation Scheduler** | ✅ **Complete** — Scheduler service triggers automated jobs based on target hourly intervals. Live settings page polls backend automation state asynchronously. |
| **13 Database & Storage Migration** | ✅ **Complete** — Moved database (jobs, config, history, locks) to Supabase tables, and media assets (rendered videos, voice audio, visual cache files) to Supabase Storage buckets (`rendered-videos`, `voice-audio`, `visual-cache`), enabling full serverless/container deployment. |
| 14 YouTube Analytics | ❌ Not started |
| 15 AI Performance Intelligence | ❌ Not started |

## Language support commitment

**Tamil is a mandatory, permanent supported language for VidPilot.** It must never be silently dropped or permanently marked unsupported at any layer (script generation, voice, visuals, subtitles, rendering, and eventually upload metadata) — the fix is always to find or build the right provider for that stage, never to remove the language.

## Master document changelog

- **After Phase 4 (original Phase 5):** Created this document.
- **Phase restructuring (2026-08-10):** Roadmap expanded from 14 to **15 phases**. Split into four dedicated phases: 5, 6, 7, 8.
- **Phase 5 + 6 shipped, 7 + 8 mostly shipped (2026-08-10, later same day):** Ken Burns zoom, Pixabay/Pexels, Jamendo music, SFX.
- **Phases 7–10 fully shipped (2026-08-11):** Word-by-word subtitles, cross-scene transitions, Quality Control validation, Telegram bot approval.
- **Phase 11 (YouTube Upload) shipped (2026-08-11, later same day):** Connected channel, upload to YouTube with synthetic content flags.
- **Phase 12 (Automation Scheduler) & Supabase Migration (2026-08-12):** Scheduler settings frontend/backend sync complete. Configured Supabase integration for Postgres DB persistence (jobs, config, locks, history) and Storage buckets (rendered-videos, voice-audio, visual-cache) for cloud deployment. Verified with database seed scripts.
- **Production fixes & deployment prep (2026-08-13):** Restored `@opentelemetry/api` (required by firebase-admin/Firestore at runtime). Fixed scheduler singleton so only one tick loop runs per process. Added wall-clock **Next Run At** picker on Scheduler page. Added `render.yaml` (Render backend) and `frontend/vercel.json`. Documented Render 512 MB memory limits and Supabase-first deployment path.

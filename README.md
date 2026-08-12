# VidPilot AI

A personal, single-user AI video production and YouTube publishing workspace. Give it a topic, and it plans, writes, voices, sources real content-matched visuals, mixes licensed music/SFX, subtitles, renders, quality-checks, and sends a real playable video to your Telegram for approval — then (in later phases) publishes to YouTube and tracks performance to inform the next topic.

**Current state:** Script → Voice → Visuals → Music/SFX → Subtitles → Render → Validate → Quality Control → Telegram Approval → **YouTube Upload** is fully built and producing real, verified output, end to end — a real human decision on your phone gates the last automated step, a real Google OAuth connection and a real `videos.insert` call publish it. The default output format is **vertical 9:16 Shorts (1080×1920)** — 16:9 landscape is still fully supported, just not the default (see "Switching back to 16:9" below). No thumbnail generation runs yet — the `ThumbnailAsset`/`uploadThumbnail` plumbing exists and is exercised in tests, but nothing in the job pipeline generates one yet, so every real upload today goes out with YouTube's own auto-picked thumbnail.

## What VidPilot can do today

### Job management
- Create Video form → `VideoJob` persisted via the backend (Firestore, or an automatic local-JSON fallback when Firestore isn't configured)
- A required **content category** (General Knowledge, Mystery, Motivation, Technology, AI, Science, History, Space, Facts, Business, Psychology, Story, News/Current Events) — user-selected, never AI-guessed, since it deterministically drives music selection and AI prompting tone
- Video Queue with filters, Job Details with the full pipeline history, cancel/retry, Dashboard with real (not fabricated) counts per stage

### AI script generation
- Real script generation via **Gemini**, falling back to **OpenRouter** if Gemini fails — never a hardcoded/mocked script
- Style/duration/language/content-category-aware prompting, producing a structured `VideoContent` (title, hook, introduction, ordered scenes with narration + on-screen text + visual keywords + emotion/energy + scene role, conclusion, YouTube description, tags) — schema-validated, never raw AI prose
- A repetition guard compares a new script against recent jobs' titles/hooks before accepting it
- Script regeneration with an optional user instruction ("make the hook punchier")

### Expressive Voice Engine
- **Piper TTS** (self-hosted binary, no paid API) for English and Hindi — real installed voice models, per-scene WAV files
- **Microsoft Edge TTS** (free, no API key, network-based) for **Tamil** — see "Why two voice providers" below
- **Voice direction system** — each scene's AI-assigned emotion (excitement, curiosity, seriousness, warmth, tension, neutral, etc.) maps to a real pace/pitch/pause profile (`voiceDirectionSystem.ts`); Edge TTS gets real prosody (`pitchHint`/`volumeHint`), Piper gets real playback-speed adjustment — never a fake "emotion" label with no audible effect
- **Sentence-level synthesis with real pauses** — narration is split per-sentence (grapheme-safe, handles Hindi Devanagari `।`/`॥` and trailing closing quotes/brackets correctly), each sentence synthesized separately, and genuine silence clips are inserted between them (`narrationSegmenter.ts`, `audioProcessor.ts`) — pacing that actually sounds like delivery, not a monotone wall of text
- **Real audio processing** — trim leading/trailing silence, concatenate with the inserted pauses, normalize + limit + fade (ffmpeg `loudnorm`/`alimiter`/`afade`)
- **Extended validation** beyond "did the process exit 0": file exists, valid header, real duration, not silent (RMS check), no sustained clipping, no unexplained internal silence gap beyond what the pause plan expects
- Real measured duration for every scene, parsed from the actual generated audio — never estimated from word count
- Partial-failure safe: one failed scene never discards the others' audio; a retry only touches what still needs it

### Dynamic Visual Engine (real internet sourcing, not gradients)
- `VisualProvider` interface; the shipped implementation searches **real stock media**, video-first: **Pixabay Videos → Pexels Videos → Pixabay Images → Wikimedia Images → a deterministic procedural background** as the last resort if every real source comes up empty for a query
- **Per-asset license verification before use** — every candidate's actual license/usage terms are checked; if it can't be verified as safe, it's never used, no exceptions (`visualLicense.ts`)
- **Content-matched search queries** built from the AI's own `visualKeywords` per scene (`visualQueryBuilder.ts`), not generic style buckets
- **Multiple short clips per scene** (0.8–3s, energy-dependent — a high-energy scene gets more, faster cuts; a calm one gets fewer, longer holds), with real motion (Ken Burns pan/zoom on stills) and transitions between them (`visualPlanningEngine.ts`, `transitionSystem.ts`, `motionSystem.ts`)
- Deterministic selection (`hashString(seed) % candidates.length`) — a retry lands on the same assets, so retrying doesn't silently change how the video looks
- Downloaded assets are cached (`storage/visual-cache/`) so the same source is never re-fetched across jobs
- Falls back to the original deterministic local templates/palettes (`localVisualProvider.ts`) when no API key is configured or a query genuinely returns nothing usable — never a crash, never a fake asset

### Music & Sound Effects Engine
- **Jamendo** (real API, free) is the primary background-music source — searches by the job's content-category mood tags, downloads and caches the track, and **verifies the specific license per track**: only plain **CC BY** and **CC BY-SA** are used; NonCommercial and NoDerivatives variants are rejected outright (NC can't go on a monetizable YouTube video; ND can't legally be trimmed/looped, which this pipeline always does) — never a guessed-safe license
- **`LocalMusicProvider`** is the automatic fallback — your own manually-sourced, rights-cleared tracks under `backend/assets/music/`, indexed by `manifest.json`; used whenever Jamendo is unconfigured, has no license-safe match for that mood, or hits a network error. A file with no manifest entry is never used, even if you own the rights but haven't documented it yet
- **`LocalSfxProvider`** — the same manifest-gated model for sound effects (`backend/assets/sfx/`), triggered by real signals already in the pipeline: a `whoosh` on hook scenes, an `impact` on reveal scenes — never a random or guessed trigger
- **Real dynamic ducking** — background music is trimmed/looped to the scene's exact narration duration, faded in/out, and mixed under the narration with genuine ffmpeg `sidechaincompress` (the narration triggers the ducking; the music itself is the signal that gets quieter and recovers — see "Recent fixes" below for a bug that briefly had this backwards)
- **Full attribution metadata stored per scene** — track title, artist, source, source URL, license, and whether attribution is required, all recorded on the job (`scene.audio.music*` fields), never just "music: yes/no"
- One consistent musical theme per Short (content category → one of 7 mood folders: motivation, curiosity, mystery, technology, emotional, energetic, general) rather than per-scene mood flip-flopping

### Subtitle & Caption Engine (real safe-zone layout, not fixed pixels)
- Segments each scene's narration into readable cues (sentence-boundary aware, long sentences broken on grapheme-safe word boundaries) and times them against the scene's **real measured audio duration** — never `estimatedDuration`
- Uses `Intl.Segmenter` grapheme-cluster boundaries, not raw string/byte offsets, so a cut never lands inside a Tamil or Hindi combining character sequence
- **Real safe-zone system** (`remotion/layout/safeZones.ts`) — every text element's position is a fraction of the actual composition width/height (top-safe margin, title band, bottom-platform margin, subtitle region, horizontal margins), so the same code is correct at any resolution/aspect ratio instead of hand-picked coordinates tuned for one format
- **Real Chrome text measurement** (`remotion/layout/subtitleLayout.ts`) — since Remotion renders in an actual headless Chrome, caption wrapping and font-size fitting use genuine `canvas.measureText()`, never an estimate; a caption's font shrinks in real steps until it genuinely fits its region, and lines only ever break on word boundaries
- **Three non-overlapping layers**: full-frame visual footage on the bottom, the hook/title headline confined to its own title band, and narration captions confined to their own bottom-safe region — they never compete for the same screen space
- **Word-by-word kinetic caption reveal** — each word fades/scales/translates in on its own real timing window (`wordTiming.ts` distributes a cue's actual measured duration across its words by grapheme-proportional length, not a fixed per-word duration), so pacing follows real speech timing rather than a guessed constant
- **Emphasis scale-pop** on AI-selected (or, if the AI gave none, deterministically inferred — digit tokens preferred, else the longest word) highlighted words/phrases, with reveal speed and pop intensity driven by the same emotion/energy/scene-role tiers the visual motion system already uses (`captionPacing.ts`) — a high-energy GK fact pops faster and harder than a slow-burn mystery reveal, not a single global animation setting
- Word-emphasis highlighting rendered in an accent color with correct, even word spacing (see "Recent fixes" below)

### Video Rendering Engine
- **Remotion** renders each scene as a full composition (visual clips with motion/transitions, hook/title overlay, burned-in dynamic captions, the scene's real mixed audio) to an H.264/AAC MP4, using a real installed Chrome and Remotion's own bundled compositor
- **Config-driven output dimensions** — `VIDEO_WIDTH`/`VIDEO_HEIGHT` (default **1080×1920**, vertical) flow into both the Remotion composition (`calculateMetadata`) and every layout component; nothing is hardcoded to one aspect ratio
- **Real cross-scene transitions** — `sceneTransitionPlanner.ts` picks a transition (`cut`/`crossfade`/`fade`/`push_*`/`zoom`/`zoom_burst`) per scene boundary from content-category-specific candidate lists, sized by emotion/energy and clamped to a fraction of the shorter adjacent scene, with a repetition guard so the same transition doesn't fire twice in a row; `sceneTransitionConcat.ts` executes it for real via ffmpeg `xfade`/`acrossfade` (falling back to the original fast stream-copy concat when every boundary is a plain cut) — the final video's real duration reflects the actual blend time, not a naive sum of scene durations
- **FFmpeg** (a separately downloaded static build, distinct from Remotion's internal one) blends/concatenates the scene MP4s into the job's final video and probes it for validation
- Video validation before a job can reach `VIDEO_READY`: file exists and is non-empty, has both a video and an audio stream, correct codec (H.264/AAC) and resolution, duration within tolerance of the real narration-audio duration, and not an almost-entirely-black render (`blackdetect`)
- Extended state machine, **no skipped states**: `VOICE_READY → GENERATING_VISUALS → GENERATING_SUBTITLES → RENDERING → VIDEO_VALIDATION → VIDEO_READY → QUALITY_CHECK → READY → AWAITING_APPROVAL → APPROVED/REJECTED`, any failure at any stage → `FAILED` with the reason recorded
- **Retry re-renders only rendering** — visuals/subtitles/voice already `ready` from a previous attempt are skipped
- Job Details gets a **Video** card: generation status while running, a native `<video>` player once ready (streamed from the backend, never a raw filesystem path, and staying visible through every later pipeline stage), and a "Regenerate Video" action

### Quality Control Engine
- Runs eight real validators against the job's **actual rendered file and generated content** — never against configuration or expected values: technical video (re-probes the real file via `ffprobe`), audio (`astats`/`silencedetect` on the final muxed track — narration presence, loudness bands, clipping via peak level, unexplained silence gaps), captions (cue timing sanity, highlight words actually appearing in narration), visuals (missing assets, visual repetition), sync (visual/caption duration vs. real audio duration, transition-aware tolerance), metadata (title/description/tags/scenes completeness), content relevance (deterministic keyword-overlap between a visual asset's real search query and the scene's narration), and licensing (every real visual asset and music track has a recorded license, attribution present when required)
- **Transparent, weighted scoring** (video 20 / audio 20 / captions 15 / visuals 15 / sync 15 / metadata 7 / content 5 / license 3 = 100) — a category scores full weight on PASS, 60% on WARN, zero on FAIL; overall status is FAIL if any issue is CRITICAL or any category outright FAILs, else WARN if anything WARNs, else PASS — the score is descriptive, it never overrides that determination
- `VIDEO_READY → QUALITY_CHECK → READY` (PASS or a non-blocking WARN) or `→ FAILED` (a real defect) — same recoverable-via-retry convention as every other stage, never silently discards the render
- Job Details gets a **Quality Check** card: category-by-category PASS/WARN/FAIL with expandable real issue messages, overall score, and a "Run Quality Check" action

### Telegram Approval Gate
- Real Telegram Bot API integration (`TelegramBotProvider`, plain `fetch`, no SDK) — a QC-passed video is sent to your configured chat as the **actual rendered MP4** with a real caption (title, category, language, duration, resolution, QC score, scene count, voice, music, visual-source licensing) and inline **✅ APPROVE / ❌ REJECT** buttons
- **Reject** prompts for a real reason — either a free-text reply or a quick-reason button (Captions/Voice/Visuals/Music/Timing/Script/Other) — recorded on the job and shown in the UI; a rejected job can't be resent for approval until it's been re-rendered
- **Security**: every callback/message is checked against your one configured chat id; a compact `callback_data` encoding carries the job id + an approval **version** that increments on every resend, so an old Telegram message can never approve a newer render — checked structurally (a fresh render clears `approval` entirely) and again explicitly (a stale version is rejected, the job untouched); every callback is always answered (no stuck spinner, including on an unexpected backend error) and buttons are removed the moment a decision is made so a second tap can't do anything
- Long-polling (`telegramPoller.ts`, started at server boot) is the transport that actually works without a public URL; a real webhook route (`POST /api/telegram/webhook`, validated via Telegram's own `X-Telegram-Bot-Api-Secret-Token` header) exists for a real production deployment
- `READY → AWAITING_APPROVAL → APPROVED` or `→ REJECTED` (with the real reason recorded); Job Details gets an **Approval** card showing status, sent time, and decision, plus a "Send for Telegram Approval" / "Resend" action

### YouTube Upload Engine
- Real Google OAuth2 via the official `googleapis` package — connecting is a genuine browser navigation to Google's own consent screen (`GET /api/youtube/auth` redirects there; nothing here is a `fetch()` call), scoped to only `youtube.upload` + `youtube.readonly`. The refresh token is persisted to its own local JSON file (`backend/data/youtubeToken.json`, gitignored) — deliberately **not** Firestore/job storage, since it's a live credential, not job metadata — and auto-refreshes on every real API call
- The real connected channel (id, title, thumbnail) is fetched once at connect time and shown in Settings; `GET /api/youtube/status` reports the true connection/configuration state, never an assumed one
- **Strict, backend-only upload gating** — `POST /api/jobs/:id/youtube/upload` refuses unless the job's own durable records say so: `approval.status === "approved"` **and** `approval.renderVersion === job.renderVersion` (a re-render after approval invalidates the old approval, same mechanism Telegram's version check already uses), `qualityReport.status === "PASS"` (a WARN is not enough), and a real `videoRender.status === "ready"` — none of this is ever trusted from the client
- **Re-validates the actual rendered file right before upload** — even though QC already re-probed it, the upload step calls the same real `ffprobe`-backed validator again against the file on disk, never against cached Firestore/job JSON, immediately before the real `videos.insert` call
- **Duplicate-upload protection**: a job that already has a real `videoId` on record refuses a second upload outright — the only way to publish again is a genuinely new job. A failed upload can be safely retried (it doesn't need to go back through Telegram — the existing approval still counts)
- Upload metadata (`youtubeMetadata.ts`) is built entirely from what the job already generated — real AI title/description/tags, a deterministic content-category → YouTube category id mapping, real music/visual attribution credits collected from the scenes that actually used a licensed asset, and a fixed synthetic-media disclosure appended to every description plus `containsSyntheticMedia: true` on every upload (YouTube's own real API field for this, added 2024) — never invented, never omitted
- `APPROVED → UPLOADING → PUBLISHED` on a real, confirmed `videos.insert` response, or `→ FAILED` (with the real classified reason — `not_connected`/`invalid_grant`/`quota_exceeded`/`network`/`api_error` — recorded on `job.youtube.lastError`) on any failure; a thumbnail upload failure never fails the video upload itself
- Job Details gets a **Publish** card: real connection-aware upload button, the real published URL/video id/privacy status once uploaded, and a clear reason when upload isn't eligible yet. Published Videos lists every job that's actually reached `PUBLISHED`, pulled live from the backend — not a static mock table

### Switching back to 16:9
Set `VIDEO_WIDTH=1920` / `VIDEO_HEIGHT=1080` in `backend/.env` — every layout component reads real composition dimensions at render time, so no code changes are needed for either aspect ratio.

### Why two voice providers (and why Tamil isn't Piper)

Tamil has no published Piper acoustic model — Piper's own bundled `espeak-ng-data` does contain real Tamil phoneme data, but phoneme data alone can't synthesize speech without a trained model, and none exists for Tamil as of this writing. The standalone `espeak-ng` CLI was evaluated as a fully local fallback but the only Windows distribution is an MSI installer that produced a binary segfaulting on `--version` alone, with no working portable build found. Tamil instead routes to **Microsoft Edge's free "Read Aloud" service** — real neural voices (`ta-IN-PallaviNeural`, `ta-IN-ValluvarNeural`), reached over a WebSocket, no API key or payment. It's a network dependency rather than a local binary, which is the one honest trade-off versus Piper.

Which provider handles a voice is a property of the voice itself (`services/voice/voiceConfig.ts`); `voiceEngine.ts` dispatches to the right one per scene.

## Recent fixes (real bugs found via real generated output, not assumed)

- **Caption word-spacing collapse** — whitespace spans between words didn't inherit the same font-size as the word spans around them, so spaces rendered at a fraction of their real width and looked invisible next to bold highlighted text. Fixed in `DynamicCaption.tsx`; confirmed by extracting and visually inspecting real rendered frames.
- **Background music silently missing from every render** — ffmpeg's `sidechaincompress` filter had its two inputs swapped in `audioMixer.ts`. That filter only outputs the audio of its *first* input (the second is a control signal only); with narration as input #1 and music as input #2, the "ducked music" branch was actually a compressed copy of the narration, and the real music track never reached the output. Fixed the input order, added a regression test that checks a real gap in the narration for actual music energy (not just a "music was used" flag, which is why the old test suite didn't catch it), and confirmed via spectrogram analysis of real rendered audio.
- **Jamendo's `fuzzytags` search parameter behaves like AND, not OR** — a single request with several comma-joined mood tags (e.g. `uplifting,energetic,inspiring,epic,motivational`) reliably returned zero results, verified directly against the live API. Fixed by querying each tag separately and merging license-safe candidates — genuine OR semantics via real separate requests instead of relying on undocumented separator behavior.
- **Sentence-splitting regex broke on a terminator followed by closing punctuation** (e.g. `"...you think.'"`), producing a degenerate near-empty audio fragment that failed validation. Fixed in `narrationSegmenter.ts`/`subtitleTiming.ts`; traced to and reproduced from a real job failure.
- **ffmpeg `xfade` requires both video inputs to share the same internal timebase** — Remotion's own render output and this project's own concat-filter/libx264 re-encodes use different default timebases, so a 3+-scene transition chain failed outright with a timebase mismatch error. Invisible to synthetic ffmpeg-only test fixtures (both sides share ffmpeg's own default); only reproducible against genuine Remotion output. Fixed with explicit `fps=30,settb=AVTB` normalization before every `xfade`/`concat` node in `sceneTransitionConcat.ts`, with a regression test that forces the real-world condition via `-video_track_timescale`.
- **ffmpeg `astats`'s "Peak count" field does not measure sustained clipping** — verified empirically (real overdriven vs. mild audio) that it stays at 1–2 regardless of how clipped a track actually is. Removed that check; the audio quality validator now uses **Peak level dB alone** for clipping detection, documented as such.
- **Video playback broke the moment Quality Control ran** — the video-serving route (and, separately, the frontend's derived "is the video ready" state) both gated on `job.status === "video_ready"`, which QC immediately moves the job past. Fixed both to key off `videoRender.status === "ready"` alone — the actually-relevant fact — so a QC'd video stays playable.
- **A Telegram chat id was actually the bot's own id** — `TELEGRAM_CHAT_ID` set to the bot's numeric id causes every send to fail with a real `403 Forbidden: the bot can't send messages to the bot`; recovered by having the user message the bot and reading their real id back from `getUpdates`.
- **An unexpected error during a Telegram callback left the tapped button spinning forever** — `handleTelegramUpdate`'s per-action logic had no top-level error handling, so an infrastructure failure (witnessed live: a Firestore quota outage mid-approve) crashed out before ever calling `answerCallbackQuery`. Fixed with a catch that still answers the callback (or messages the chat, for a free-text reply) with a real "try again" notice.

## Architecture

```
Topic + Content Category → AI Content Engine → Voice (Piper / Edge TTS + voice direction)
      → Dynamic Visual Engine (Pixabay/Pexels/Wikimedia, license-verified)
      → Music & SFX Engine (Jamendo + local, real ducking) → Subtitle & Caption Engine (safe-zone layout, kinetic reveal)
      → Video Rendering (Remotion, 9:16 default, real cross-scene transitions) → Video Validation (FFmpeg)
      → Quality Control (8 real validators, weighted score) → Telegram Approval (real bot, real human decision)
      → YouTube Upload (real Google OAuth + videos.insert) → Analytics → AI Insights → next topic
```

Everything through **YouTube Upload** is real and working. Analytics onward still throws a clear "not implemented" error or simply doesn't exist yet.

### The render pipeline, end to end

```
renderVideoForJob(jobId)                                    ← one job-service call, one REST endpoint
        │
        ▼  guard: job.status ∈ {VOICE_READY, VIDEO_READY, FAILED}, every scene's audio already READY
        │
   GENERATING_VISUALS
        ▼
  runVisualGeneration({ jobId, jobStyle, contentCategory, language, scenes })
        │  per scene: build a content-matched query → try Pixabay Videos → Pexels Videos →
        │  Pixabay Images → Wikimedia Images → procedural fallback; verify license; plan
        │  multiple short clips with motion/transitions (skips scenes already visual-READY)
        ▼
   GENERATING_SUBTITLES
        ▼
  runSubtitleGeneration({ scenes })
        │  segmentNarration() + distributeTiming() per scene — real audio.duration is the only clock
        ▼
   RENDERING
        ▼
  renderJobVideo({ jobId, language, scenes })
        │  one shared headless Chrome instance renders each scene via Remotion — real safe-zone
        │  layout, real canvas text measurement, config-driven 9:16/16:9 dimensions
        ▼
  concatScenesWithTransitions() — planSceneTransition() picks a real transition per boundary
        │  (content-category + emotion/energy aware, repetition-guarded); ffmpeg xfade/acrossfade
        │  executes it, or a fast stream-copy concat if every boundary is a plain cut
        ▼
   VIDEO_VALIDATION
        ▼
  validateVideoFile(finalPath, totalRealAudioDuration)
        │
        ├─ invalid  → job → FAILED, videoRender.error records why, nothing else touched
        └─ valid    → job → VIDEO_READY, videoRender metadata recorded (never the binary)

runQualityCheckForJob(jobId)                                 ← separate call, run once a video is ready
        ▼
   QUALITY_CHECK
        ▼
  runQualityControl(job) — 8 real validators against the actual file/content, weighted score
        │
        ├─ FAIL        → job → FAILED, lastError summarizes the real failures
        └─ PASS/WARN    → job → READY, qualityReport recorded

sendApprovalRequestForJob(jobId)                              ← separate call, sends the real video
        ▼
   AWAITING_APPROVAL  — real Telegram message sent (video + caption + Approve/Reject buttons)
        │
        ├─ human taps ❌ REJECT (+ real reason)  → job → REJECTED, approval.reason recorded
        └─ human taps ✅ APPROVE                  → job → APPROVED, approvedAt recorded
```

Voice generation (`generateVoiceForJob`) runs before this and additionally resolves music/SFX per scene, mixes them into the narration with real ducking, and records full attribution metadata on `scene.audio`.

A retry re-enters the render pipeline at the top: visuals/subtitles already `ready` from a previous attempt are skipped, so only rendering — the thing that actually failed — genuinely redoes work. A fresh successful render always clears any prior `approval` record and bumps `renderVersion`, so an approval decision can never be about a render that's since changed.

`services/visual/` layout: `visualProvider.ts` (interface + error type), `dynamicVisualProvider.ts` (real internet sourcing), `localVisualProvider.ts` (deterministic no-API fallback), `providers/` (`pixabayProvider.ts`, `pexelsProvider.ts`, `wikimediaProvider.ts`, `httpClient.ts`), `visualQueryBuilder.ts`, `visualLicense.ts`, `visualPlanningEngine.ts`, `motionSystem.ts`, `transitionSystem.ts`, `assetSearchEngine.ts`, `assetDownloader.ts`, `assetCache.ts`, `captionSystem.ts`, `contentOverlayPlanner.ts`, `emotionPalettes.ts`, `templates.ts`, `visualEngine.ts` (per-scene orchestrator).

`services/voice/` layout: `voiceProvider.ts`, `piperProvider.ts`, `edgeTtsProvider.ts`, `voiceDirectionSystem.ts` (emotion → pace/pitch/pause), `narrationSegmenter.ts` (sentence-level splitting), `audioProcessor.ts` (trim/concat-with-pauses/normalize/fade), `audioValidator.ts` (extended: clipping + internal-silence detection), `audioMetadata.ts`, `audioStorage.ts`, `audioTranscode.ts`, `voiceConfig.ts`, `voiceEngine.ts` (per-scene orchestrator — also resolves music/SFX and calls the mixer).

`services/audio/` layout: `jamendoProvider.ts` (real API search/license-verify/download/cache), `musicProvider.ts` (`LocalMusicProvider`, manifest-gated), `musicResolver.ts` (Jamendo primary, local fallback), `sfxProvider.ts` (`LocalSfxProvider`), `audioMixer.ts` (real ffmpeg ducking/fade/trim-loop/SFX overlay), `contentCategory.ts` (category ↔ music-folder mapping).

`services/subtitle/` layout: `subtitleTiming.ts` (pure text/timing functions), `subtitleEngine.ts` (per-scene orchestrator).

`services/video/` layout: `remotionRenderer.ts` (bundles the `remotion/` project once per process, renders one scene per call, owns the shared-browser lifecycle, passes config-driven `videoWidth`/`videoHeight`), `renderEngine.ts` (per-job orchestrator), `sceneTransitionPlanner.ts` (picks a real transition type/duration per scene boundary), `sceneTransitionConcat.ts` (executes it via ffmpeg `xfade`/`acrossfade`, or falls back to the original fast concat), `videoConcat.ts`, `videoValidator.ts`, `videoStorage.ts`.

`services/ffmpeg/ffmpegRunner.ts`: the one place that spawns the downloaded ffmpeg/ffprobe binaries — args always as an array, never a shell string.

`services/quality/` layout: one validator per category — `videoQualityValidator.ts`, `audioQualityValidator.ts`, `subtitleQualityValidator.ts`, `visualQualityValidator.ts`, `syncQualityValidator.ts`, `metadataQualityValidator.ts`, `contentQualityValidator.ts` (+ `ContentQualityProvider`/`LocalHeuristicProvider`), `licenseQualityValidator.ts` — plus `qualityControlEngine.ts` (runs all eight, computes the weighted score and overall status).

`services/telegram/` layout: `telegramProvider.ts` (interface), `bot.ts` (`TelegramBotProvider` — the one real implementation, plain `fetch`), `callbackData.ts` (compact `callback_data` encode/decode + button builders), `approvalMessage.ts` (real caption text from the job's own content/QC/render metadata), `telegramUpdateHandler.ts` (transport-agnostic approve/reject/reason-reply logic), `telegramPoller.ts` (the long-poll loop started at server boot), `sendApproval.ts` (the seam between job-state validation and the real Telegram send).

`remotion/` (project root, not inside `backend/src/`): `index.ts`, `Root.tsx` (single `Scene` composition, width/height/duration all computed per-render via `calculateMetadata`), `SceneComposition.tsx`, `components/` (`VisualSegmentLayer.tsx`, `HookOverlay.tsx`, `DynamicCaption.tsx`, `ContentOverlay.tsx` — all proportional to real composition width/height, no hardcoded pixels), `layout/` (`safeZones.ts`, `subtitleLayout.ts` — real canvas-based measurement).

### Fonts (Tamil/Hindi/English Unicode correctness)

`backend/assets/fonts/{english,hindi,tamil}/` — [Noto Sans](https://fonts.google.com/noto/specimen/Noto+Sans), [Noto Sans Devanagari](https://fonts.google.com/noto/specimen/Noto+Sans+Devanagari), and [Noto Sans Tamil](https://fonts.google.com/noto/specimen/Noto+Sans+Tamil), all OFL-licensed. `SceneComposition.tsx` imports each file directly rather than via Remotion's `staticFile()` convention. A scene's `language` prop selects the matching `font-family` at render time — proven via real extracted-frame inspection, not assumed.

### Why two ffmpeg builds exist in this repo

Remotion's own compositor package bundles its own matched ffmpeg/ffprobe/compositor triplet — `remotionRenderer.ts` deliberately never points it at this project's separately downloaded ffmpeg, since overriding Remotion's `binariesDirectory` requires supplying all three matched binaries. The separately downloaded ffmpeg (a static win64 GPL build) is used everywhere else: audio transcoding/mixing/ducking, final-video concatenation, and video validation.

### Security

Both the scene-audio route and the job-video route never take a filesystem path from the client — the id only selects which of the job's *own* records to look up. Piper and ffmpeg/ffprobe are invoked via `child_process.spawn` with an argument array (never a shell string); narration text goes over stdin for Piper, never argv. Edge TTS and Jamendo communicate over HTTPS/WebSocket to their respective services — no credentials are ever sent to the frontend; `JAMENDO_CLIENT_ID`/`JAMENDO_CLIENT_SECRET`, `PIXABAY_API_KEY`, and `PEXELS_API_KEY` are backend-only. The Google OAuth client secret and the real refresh token behave the same way — both stay backend-only, the token lives in its own gitignored local file (never Firestore, never a client-visible field), and the upload endpoint never trusts a client-supplied approval/QC/connection state — it re-reads the job's own durable records and re-checks the actual connection every time.

### Other carried-forward decisions
- **Human approval before publish** — real: `AWAITING_APPROVAL → APPROVED/REJECTED` via a genuine Telegram decision, not a stub, and the actual YouTube upload gate re-checks that decision (plus that it's still for the *current* render) before ever calling the real API.
- **Real-time-ish updates via polling**, not Firestore listeners or WebSockets. The UI shows an honest per-stage label, never a fabricated percentage.
- **API/compute cost control** — rendering, quality checks, Telegram sends, and YouTube uploads are only ever triggered by an explicit user action.

## Tech Stack

**Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, React Router v7, Lucide icons, oxlint
**Backend:** Node.js, TypeScript, Express, **firebase-admin**, **zod**, **vitest**, **googleapis**
**AI providers:** Gemini + OpenRouter (script)
**Voice:** **Piper TTS** (English/Hindi, self-hosted binary) + **Microsoft Edge TTS** (Tamil, free network service)
**Visuals:** **Pixabay** + **Pexels** (video/image APIs, free keys) + **Wikimedia Commons** (no key needed) + deterministic local fallback
**Music:** **Jamendo** (real API, free, CC-licensed tracks) + a manually-curated local library fallback
**Rendering:** **Remotion** driving a real installed **Google Chrome**, plus a separately downloaded **FFmpeg** static build for concatenation/mixing/validation
**Fonts:** Noto Sans / Noto Sans Devanagari / Noto Sans Tamil (OFL)
**Database:** Firebase Firestore (via backend Admin SDK) with an automatic local-JSON fallback
**Approval:** **Telegram Bot API** (real bot, long-polling + webhook transport, no SDK)
**Publishing:** **YouTube Data API v3** via the official `googleapis` OAuth2 client — real upload, real connected-channel lookup
**Planned integrations (later phases):** YouTube Analytics API

## Folder Structure

```
vidpilot/
├── frontend/
│   ├── src/
│   │   ├── components/jobs/    ScriptGenerationStatus, ScriptPreview, VoiceGenerationStatus,
│   │   │                       VoiceScenesList, VideoRenderStatus, VideoPlayer, PipelinePreview,
│   │   │                       JobsTable, QualityReportCard, ApprovalStatusCard
│   │   ├── services/voice/     voicesService.ts (list voices, preview voice, scene audio URLs)
│   │   ├── services/jobs/      jobRepository.ts, jobService.ts
│   │   ├── types/               VideoJob, VideoScene, SceneAudio, SceneVisual, SubtitleCue,
│   │   │                        ContentCategory, VideoRenderMetadata, JobStatus
│   │   └── ...
│   └── package.json
│
├── backend/
│   ├── vendor/                  gitignored — Piper binary + voice models, FFmpeg static build
│   ├── assets/
│   │   ├── fonts/                Noto Sans (english/hindi/tamil) — OFL-licensed, committed
│   │   ├── music/                 your manually-curated tracks + manifest.json (fallback source)
│   │   └── sfx/                    your manually-curated SFX + manifest.json
│   ├── remotion/                 Remotion project: Root.tsx, SceneComposition.tsx, components/, layout/
│   ├── storage/                  gitignored — scene audio, visual/jamendo asset caches, scene renders,
│   │                              final video (workspace only, never the source of truth)
│   ├── scripts/                  scanAudioAssets.ts — reports music/sfx files missing a manifest entry
│   ├── src/
│   │   ├── services/
│   │   │   ├── ai/               script generation (Gemini + OpenRouter), schema, prompts, validators
│   │   │   ├── voice/             voice providers, voiceDirectionSystem, narrationSegmenter,
│   │   │   │                      audioProcessor, audioValidator, voiceEngine (+ *.test.ts)
│   │   │   ├── audio/             jamendoProvider, musicProvider, musicResolver, sfxProvider,
│   │   │   │                      audioMixer, contentCategory (+ *.test.ts)
│   │   │   ├── visual/            dynamicVisualProvider, localVisualProvider, providers/ (pixabay,
│   │   │   │                      pexels, wikimedia), visualPlanningEngine, motionSystem,
│   │   │   │                      transitionSystem, visualLicense, visualQueryBuilder,
│   │   │   │                      visualEngine (+ *.test.ts)
│   │   │   ├── subtitle/          subtitleTiming, subtitleEngine (+ *.test.ts)
│   │   │   ├── video/             remotionRenderer, renderEngine, videoConcat, videoValidator,
│   │   │   │                      videoStorage (+ *.test.ts, testFixtures.ts)
│   │   │   ├── ffmpeg/            ffmpegRunner.ts — the one place that spawns ffmpeg/ffprobe
│   │   │   ├── quality/           8 real validators (video/audio/captions/visuals/sync/metadata/
│   │   │   │                      content/license) + qualityControlEngine (+ *.test.ts)
│   │   │   ├── telegram/          telegramProvider, bot (real TelegramBotProvider), callbackData,
│   │   │   │                      approvalMessage, telegramUpdateHandler, telegramPoller,
│   │   │   │                      sendApproval (+ *.test.ts)
│   │   │   ├── jobs/              job repository (Firestore + local-JSON) + orchestrator (+ *.test.ts)
│   │   │   ├── youtube/            youtubeProvider, youtubeDataApiProvider (real googleapis OAuth2 +
│   │   │   │                      videos.insert/thumbnails.set), tokenStore, youtubeCategoryMap,
│   │   │   │                      youtubeMetadata (+ *.test.ts)
│   │   │   ├── thumbnail/          thumbnailPlanner/Renderer/Validator — built, not yet wired into
│   │   │   │                      the job pipeline (see "Known Limitations")
│   │   │   └── {analytics,scheduler}/   still placeholders
│   │   ├── controllers/           jobsController, voicesController, youtubeController, statusController
│   │   ├── routes/                jobs (incl. youtube/upload), voices, status, telegram (webhook), youtube
│   │   └── server.ts
│   └── package.json
│
├── .env.example
├── MASTER_PLAN.md
└── package.json
```

## Installation

```bash
git clone <this-repo>
cd vidpilot

# Frontend
cd frontend
npm install
cp .env.example .env.local

# Backend
cd ../backend
npm install
cp .env.example .env
```

Then follow the setup sections below for real voice/visual/music/video generation. Script generation and job management work without any of them.

### Connecting Gemini / OpenRouter

See `backend/.env.example` for `GEMINI_API_KEY` / `OPENROUTER_API_KEY` (+ optional model overrides). Neither is ever sent to the browser.

### Connecting a real Firebase project (optional)

The app works with zero configuration (local JSON fallback). See `backend/.env.example` / `frontend/.env.example` for the exact variables, or briefly: enable Firestore Database in the Firebase console, generate a service account, and set `FIREBASE_PROJECT_ID` + `FIREBASE_SERVICE_ACCOUNT` in `backend/.env` plus `VITE_FIREBASE_*` in `frontend/.env.local`.

### Piper setup (English/Hindi voice)

1. Download a Piper release for your platform: <https://github.com/rhasspy/piper/releases>. Extract it to `backend/vendor/piper/` so `backend/vendor/piper/piper.exe` (or `piper` on Linux/macOS) and `backend/vendor/piper/espeak-ng-data/` both exist.
2. Download voice models from <https://huggingface.co/rhasspy/piper-voices> (both the `.onnx` and `.onnx.json` files per voice). Place them at `backend/vendor/piper-voices/<lang>/<lang_REGION>/<name>/<quality>/`, matching `services/voice/voiceConfig.ts`.
3. To add a language/voice with a real Piper model, add one entry to `VOICE_OPTIONS` — nothing else needs to change.

Without Piper installed, English/Hindi voice generation fails immediately with "Piper is not installed" rather than hanging. Tamil doesn't need Piper at all.

### FFmpeg / Chrome setup (video rendering)

1. Download a static FFmpeg build for your platform (this project used [BtbN/FFmpeg-Builds](https://github.com/BtbN/FFmpeg-Builds), `ffmpeg-n7.1-latest-win64-gpl-7.1.zip`) and extract it to `backend/vendor/ffmpeg/`. Point `FFMPEG_PATH`/`FFPROBE_PATH` at them if your extracted layout differs.
2. Install Google Chrome normally — Remotion drives it directly via `CHROMIUM_EXECUTABLE_PATH`, which defaults to the standard Windows install path. On macOS/Linux, set this explicitly.
3. Nothing else to install — Remotion's own compositor/ffmpeg comes with `npm install` and is used only for the render step itself.

### Visual sourcing setup (optional but recommended)

Get free API keys at [pixabay.com/api/docs](https://pixabay.com/api/docs/) and [pexels.com/api](https://www.pexels.com/api/), set `PIXABAY_API_KEY` / `PEXELS_API_KEY` in `backend/.env`. Wikimedia needs no key. Without either key configured, visuals fall back to the deterministic local templates — never a crash.

### Music setup (optional but recommended)

Get a free `client_id` at [devportal.jamendo.com](https://devportal.jamendo.com/) and set `JAMENDO_CLIENT_ID` in `backend/.env` (the `client_secret` is stored for completeness but unused by this read-only integration). Without it, music falls back to whatever you've manually placed in `backend/assets/music/` + `manifest.json` (see that folder's own README for the format) — and if that's also empty, videos simply render with no music, a normal and valid state, never an error.

To add your own SFX, drop files under `backend/assets/sfx/<category>/` and add a manifest entry — see that folder's README.

Run `npm run scan-audio` (from `backend/`) any time to see which music/SFX files on disk are missing a manifest entry.

### Connecting YouTube (optional — required only to actually publish)

1. In the [Google Cloud Console](https://console.cloud.google.com/), create (or reuse) a project, enable the **YouTube Data API v3**, and create an **OAuth 2.0 Client ID** of type "Web application" with an authorized redirect URI matching `YOUTUBE_REDIRECT_URI` (default `http://localhost:4000/api/youtube/callback`).
2. Set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in `backend/.env`. Never commit the downloaded client-secret JSON file itself — only the two values it contains, pasted into `.env`.
3. Start both servers, open Settings in the app, and click **Connect YouTube** — this is a real browser navigation to Google's consent screen, not a form in this app. Sign in with the YouTube account you want VidPilot to publish to and approve the requested scopes (`youtube.upload` + `youtube.readonly` — nothing broader).
4. Google redirects back to the backend, which exchanges the code for a real refresh token (stored at `YOUTUBE_TOKEN_STORE_PATH`, gitignored) and redirects your browser back into Settings, now showing your real connected channel.

Without this, every stage before YouTube upload still works fully — the **Publish** card on Job Details just stays disabled with a clear reason once a job would otherwise be eligible.

## Development Commands

```bash
# Frontend — from frontend/
npm run dev         # start Vite dev server → http://localhost:5173
npm run build       # typecheck (tsc -b, project references) + production build → frontend/dist
npm run lint        # oxlint

# Backend — from backend/
npm run dev         # start with tsx watch → http://localhost:4000
npm run build       # typecheck (full) + production build → backend/dist (test files excluded)
npm run start       # run the compiled server
npm run typecheck   # tsc --noEmit (includes *.test.ts)
npm test            # vitest run — 483 tests across 53 files
npm run scan-audio  # report which music/sfx files on disk lack a manifest entry
```

Both servers must run for any job feature to work — the frontend always talks to the backend's REST API, never to Firestore, an AI provider, Piper, Edge TTS, Jamendo, or ffmpeg directly.

**Note on `npm run dev`:** `tsx watch` auto-restarts the server on file save — convenient for iterating, but it will corrupt an in-flight render if a file changes mid-job. Use `npx tsx src/server.ts` (no watch) for a testing session with concurrent code edits.

**Frontend note:** this project uses TypeScript project references. Run `npx tsc -b` (or `npm run build`) to actually typecheck it — a plain `tsc --noEmit` against the root config silently checks nothing.

## Environment Variables

See `.env.example` (root, reference only), `frontend/.env.example`, and `backend/.env.example`. **Rule: anything prefixed `VITE_` is bundled into the browser** — never a secret, except Firebase's web config (not a secret by design).

- Piper: `PIPER_EXECUTABLE_PATH`, `PIPER_ESPEAK_DATA_PATH`, `PIPER_VOICES_DIR`, `VOICE_STORAGE_DIR`, `PIPER_TIMEOUT_MS` — all default to `backend/vendor/`.
- Edge TTS: `EDGE_TTS_TIMEOUT_MS` — no API key, network access only.
- FFmpeg/rendering: `FFMPEG_PATH`, `FFPROBE_PATH`, `FFMPEG_TIMEOUT_MS`, `FONTS_DIR`, `VIDEO_STORAGE_DIR`, `VIDEO_WIDTH`/`VIDEO_HEIGHT`/`VIDEO_FPS` (default **1080×1920**×30 — set `VIDEO_WIDTH=1920`/`VIDEO_HEIGHT=1080` for landscape), `CHROMIUM_EXECUTABLE_PATH`, `RENDER_TIMEOUT_MS`.
- Visuals: `PIXABAY_API_KEY`, `PEXELS_API_KEY`, `VISUAL_MAX_VIDEO_HEIGHT` (720), `VISUAL_MAX_IMAGE_WIDTH` (1600), `VISUAL_ASSET_CACHE_DIR`, `VISUAL_REQUEST_TIMEOUT_MS` (15000), `VISUAL_MAX_ASSETS_PER_JOB` (60).
- Music/SFX: `MUSIC_ASSETS_DIR`, `SFX_ASSETS_DIR`, `MUSIC_VOLUME` (0.5), `SFX_VOLUME` (0.7), `JAMENDO_CLIENT_ID`, `JAMENDO_CLIENT_SECRET`, `JAMENDO_CACHE_DIR`, `JAMENDO_TIMEOUT_MS` (15000, search only), `JAMENDO_DOWNLOAD_TIMEOUT_MS` (45000 — Jamendo's storage CDN is slow, measured well under 200 KB/s in some environments).
- Telegram: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` (get a free bot via @BotFather; your chat id is **not** the bot's own id — message the bot once and read your real id back from `getUpdates`, or use a helper like @userinfobot), `TELEGRAM_WEBHOOK_SECRET` (optional — only needed for a real production webhook; long-polling works without it).
- YouTube: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (a real Google Cloud OAuth client — see "Connecting YouTube" below), `YOUTUBE_REDIRECT_URI` (defaults to `http://localhost:<port>/api/youtube/callback`), `YOUTUBE_TOKEN_STORE_PATH` (defaults to `backend/data/youtubeToken.json`, gitignored — the real refresh token lives here, never in Firestore), `FRONTEND_URL` (defaults to `http://localhost:5173` — where the OAuth callback redirects the browser back to after connecting).

## Testing

`npm test` (from `backend/`) runs **483 automated tests across 53 files**, including:

- AI content engine: schema validation, provider fallback ladder, repetition guard, content-category prompting
- Voice engine: per-scene retry, partial failure, voice-direction mapping, sentence segmentation (incl. a real regression case that once broke on a terminator followed by closing punctuation), audio processing, extended validation (clipping/silence)
- Visual engine: query building, license verification, planning/motion/transition logic, provider fallback chain, template/palette determinism, motion continuity across scene boundaries
- Music/SFX: content-category → mood-folder mapping, Jamendo license parsing/allow-list, Jamendo→local fallback behavior, real ffmpeg ducking (including a regression test that checks a real narration gap for actual music energy, not just a flag)
- Subtitle timing: sentence/word-boundary segmentation, grapheme-safe splitting (dedicated Tamil test), duration-sum correctness; word-by-word reveal timing and emphasis pacing (`wordTiming.ts`/`captionPacing.ts`)
- Video validator/concat: real ffmpeg-synthesized fixtures — correct file passes; wrong resolution, missing audio stream, wrong duration, and an almost-entirely-black render each correctly fail; scene-transition planning and real `xfade`/`acrossfade` execution, including a regression test that reproduces the real Remotion-output timebase mismatch
- Quality Control: all 8 validators against real ffmpeg-generated fixtures (including a dedicated non-silent "healthy" fixture, since the shared test helper's default silent audio would otherwise fail its own audio check) plus the weighted-scoring engine
- Telegram: `callback_data` encode/decode + Telegram's 64-byte limit, approval caption formatting, the real `TelegramBotProvider` against a mocked `fetch`, and the full approve/reject/quick-reason/free-text-reply/stale-version/unauthorized-chat/resilience matrix in `telegramUpdateHandler.test.ts`
- Job state machine: script → voice → visuals → subtitles → rendering → validation → quality-check → approval → **YouTube upload**, retry behavior, per-stage failure recording, approval version/render-reset invariants
- **YouTube upload**: strict gating (approval status/render-version match, QC-PASS-only, connected-channel check), pre-upload re-validation of the actual file, duplicate-upload protection, thumbnail-upload isolation (a thumbnail failure never fails the video), and classified-error recording, all against a `FakeYouTubeProvider` — never a real Google API call in the automated suite

**Manual end-to-end verification** (not part of `npm test`, since it needs real Piper/Chrome/ffmpeg/Jamendo/stock-media/Telegram/Google, plus a real human on a real phone and a real browser-based OAuth consent step): full pipeline runs through the real REST API across multiple content categories and all three supported languages, with real extracted video frames and audio spectrograms inspected by hand, a real Quality Control run against real rendered videos via the live API, a real Telegram approval round-trip — real send, real reject with a real reason, real resend, real approve — and a real Google OAuth connect + real `videos.insert` upload, confirmed via the job's actual persisted state and by re-fetching the live video through the YouTube API, not just "the call returned 200." This is how every bug listed under "Recent fixes" above was actually found.

**The Phase 11 YouTube upload was verified this way for real**, end to end: connected the real Google account `curiomentra@gmail.com` (hitting and fixing two genuine setup issues live — a `redirect_uri_mismatch` from an unregistered callback URI, then a `403 access_denied` from the OAuth consent screen's Testing-mode test-user allowlist), confirmed the real connected channel ("CurioMentra"), ran a job to a genuine QC PASS (100/100 — two earlier candidate topics landed on QC WARN instead, from real, minor stock-video keyword mismatches, and were correctly *refused* by the upload gate rather than uploaded anyway), approved it for real on Telegram, uploaded it for real (`videos.insert` returned video id `pQI4b6tN-1w`, privacy `public`), and independently re-confirmed the live video through YouTube's own public oEmbed API (title and channel matched) — not just trusting this app's own job record.

## Known Limitations

- **Tamil voice needs network access.** Edge TTS is a free Microsoft service, not a local binary.
- **Local music/SFX manifests start empty.** `backend/assets/{music,sfx}/manifest.json` ship as empty templates — you populate them by hand with files you've confirmed the rights to (see each folder's README). Without Jamendo configured and without local files, videos render with no music, which is a valid state, not an error.
- **Jamendo is a network dependency** with a genuinely slow storage CDN (accounted for via a separate, longer download timeout) — if it's unreachable, music falls back to the local library automatically.
- **Visual relevance is keyword-matched, not scene-understood.** The visual query is built from the AI's own `visualKeywords`, so a scene can occasionally get a stock clip that's topically loose (observed once: a "resilience" narration paired with an unrelated close-up B-roll clip) — there's no computer-vision step verifying a clip's actual subject matches the narration.
- **Rendering is synchronous and can take minutes** per job (voice+visuals+render together, longer with several scenes and internet asset downloads); the YouTube upload step is a real resumable upload of that same file and can also take a while on a slow connection. There is no background-job/polling variant of these endpoints yet — a client with an aggressive fetch timeout can see its own request time out even though the server finishes successfully (confirmed harmless during manual E2E testing — the job still reaches its real final state).
- **No live per-stage progress within rendering or uploading** — the UI shows which stage is running, not a frame-by-frame or byte-by-byte percentage.
- **Quality Control's content-relevance check is keyword overlap, not real visual understanding** — same honest limitation as visual sourcing itself; it catches zero-overlap cases, not subtle mismatches.
- **Telegram approval currently relies on long-polling in local dev** — the real webhook route exists and is exercised in code/tests, but this environment has no public HTTPS URL to register it against; long-polling is the transport actually receiving your real button taps today.
- **No thumbnail generation yet.** The `ThumbnailAsset` type and `uploadThumbnail` call exist and are tested, but nothing in the job pipeline actually generates one — every real upload today goes out with whatever thumbnail YouTube auto-selects.
- **YouTube upload is single-user, single-channel.** The OAuth token store holds exactly one connected account at a time (this is a personal single-user app) — connecting a second channel replaces the first.

## Future Phases

See [MASTER_PLAN.md](MASTER_PLAN.md) for the complete project vision and full phase-by-phase plan. In its numbering, the work described in this README covers Phases 5 through 11 in full: Dynamic Visual + Scene Engine, Advanced Audio + Expressive Voice, Subtitle & Motion Graphics (including word-by-word kinetic reveal), Video Composition (including real cross-scene transitions), Quality Control, Telegram Approval, and YouTube Upload. Still ahead:

| Phase | Scope |
|---|---|
| 12 | Elapsed-time automation scheduler |
| 13 | YouTube Analytics integration |
| 14 | AI performance insights / topic recommendations |
| 15 | Cartoon / advanced animation engine |

Do not implement later phases ahead of schedule — each one builds on a working, tested version of the last.

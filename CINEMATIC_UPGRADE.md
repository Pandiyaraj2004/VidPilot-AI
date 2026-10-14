# CurioMentra cinematic upgrade — 14 October 2026

## Verified result

The manual generation pipeline produced and published **Interest Rates Explained**:
https://www.youtube.com/watch?v=Tv6QeG0crho

Independent YouTube API verification returned Public, processed, PT55S. Native output was 54.946 seconds, 1080×1920, 30 fps, H.264/AAC, 23,905,868 bytes. All eight QC categories passed, score 100/100. Seven English neural narration scenes used 1.0× speed; total narration was 56.180 seconds. Eighteen moving stock clips were used. Rendered frames were inspected for caption/headline placement. Temporary job media was deleted after publication; durable upload identifiers remain.

## Changes

- Added Generate & Upload Now to the existing dashboard. It queues one 50–60-second Short through the same pipeline, uses saved publishing visibility, and shows existing live progress and YouTube links. No additional confirmation is requested. Repeated clicks reuse an active manual job.
- Preserved automatic scheduler settings, timing, selection logic and configured duration range. Full persisted settings were compared before/after the live test. Scheduled and manual jobs share existing worker/lease protection; manual jobs can queue while scheduled work runs.
- Replaced overlapping text cards with one short editorial headline and compact phrase captions. Important text stays above the bottom 30% and away from the right controls. Fixed segmented footage playback offsets and duplicate clip selection races.
- Prefer higher-quality stock variants; reject camera instructions and unrelated decorative footage as search subjects. Added bounded CDN failure cooldown and stricter visual validation.
- Neural narration uses scene context, natural pauses and a speed ceiling of the requested 1.0×. Music continues across scenes rather than restarting. Duration repair uses measured speech and explicit word budgets.
- Fixed Edge TTS endpoint rejection using the upstream endpoint migration, installed automatically by backend postinstall. Escaped Tamil/English text for SSML, retained useful provider errors and bounded retries. Real final Tamil Pallavi and English Aria voice probes passed at 1.0×.
- Revalidate missing narration and render files on recovery, invalidate stale QC after regeneration, stop failed narration before rendering, and retain uncertain-upload duplicate protection. Provider timeouts now cover response bodies.
- Moved narration scratch files under managed job audio directories. Personal worker launches hidden; the server binds explicitly to loopback locally and writes consistent UTF-8 runtime logs.

## Tests

- Backend: **473 passed, 0 failed**. Includes scheduler regression, manual trigger API, duplicate prevention, restart recovery, native FFmpeg/QC, visual failures, storage/retention and voice/schema tests. Tests use isolated credentials and fixtures.
- Backend TypeScript and production build: passed.
- Frontend TypeScript, lint and production build: passed.
- Remotion template TypeScript: passed.
- Clean isolated npm installation of msedge-tts 2.0.8: passed.
- Real English generation, native rendering, QC, upload and independent YouTube processing verification: passed.
- Real Tamil voice synthesis: passed. A complete additional Tamil video was not rendered/uploaded during this verification.

## Operational limits

No paid services were enabled. Free neural speech/stock/AI providers can still throttle or become unavailable; failures remain bounded and cannot publish failed videos. Naturalness and audience engagement are subjective and are not guaranteed by automated QC.

Supabase object usage at verification was 216,976,911 bytes (216.98 MB), reserved 0; existing 450 MB warning and 500 MB hard cap remain. No historical cloud reset was performed.

The complete Windows runtime measured after this upgrade is 1,248,046,660 bytes (1,248.05 MB), compared with the earlier 1,247.89 MB. Production dependencies are 263,125,975 bytes; application 6,560,271; native runtime 442,143,117; installed Chrome 536,217,297. This upgrade does not establish a complete Linux runtime below 500 MB or prove rendering on free Render resources. The real local render took approximately 33 minutes. The personal worker requires this computer awake and connected; cloud deployment was not performed. Browser dashboard visual verification remained restricted by the existing browser permission; API integration and rendered-video frame verification passed.

Keep backend/scripts in deployment: npm ci runs scripts/patch-edge-client.mjs. Backend/dist remains tracked for the existing precompiled deployment strategy. Future upstream speech releases should replace the compatibility patch once their published endpoint migration is verified.

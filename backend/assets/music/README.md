# Background music library (Phase 6)

## Primary source: Jamendo (real API, automatic)

As of the Shorts upgrade, **Jamendo is the primary music source** —
`services/audio/jamendoProvider.ts` searches Jamendo's real API by mood tag,
picks a track, downloads it to `storage/jamendo-cache/` (a cache, not this
folder — never touch that directory by hand), and verifies its *specific*
license before ever using it: only plain **CC BY** and **CC BY-SA** tracks
are used. Non-Commercial (NC) and No-Derivatives (ND) variants are rejected
outright — NC can't go on a monetizable YouTube video, and ND can't legally
be trimmed/looped, which this pipeline always does. Requires
`JAMENDO_CLIENT_ID` in `backend/.env` (free at devportal.jamendo.com); with
no key configured, Jamendo is skipped entirely and this folder becomes the
only source.

## Fallback source: this folder (manual, your own files)

This folder is a local library of tracks **you've already confirmed you
have the rights to use**, indexed by `manifest.json`. It's used automatically
whenever Jamendo has no configured key, no license-safe result for a given
mood, or a network/download error — never a fake "no music" state when a
real track is available from either source.

### How it works

1. Drop an audio file (`.mp3` or `.wav`) anywhere under this folder — a
   subfolder per category is the natural way to organize it (see folder
   names below), e.g.:
   ```
   assets/music/
     motivation/upbeat-corporate.mp3
     mystery/dark-ambient.mp3
     emotional/soft-piano.mp3
   ```
2. Add one entry per track to `manifest.json`:
   ```json
   {
     "tracks": [
       {
         "file": "motivation/upbeat-corporate.mp3",
         "mood": "motivation",
         "title": "Upbeat Corporate",
         "artist": "Track Artist Name",
         "source": "YouTube Audio Library",
         "sourceUrl": null,
         "license": "Royalty-free (YouTube Audio Library)",
         "attributionRequired": false,
         "attributionText": null
       }
     ]
   }
   ```
   `title`/`artist`/`sourceUrl` are optional (title falls back to the
   filename) but recommended — they show up in the same attribution fields
   a real Jamendo track would populate.

**A file with no matching manifest entry is never used** — same rule as
Phase 5's internet visual assets: no license record, no use, even for a
file you already own the rights to but haven't documented yet.

## Folder / mood values

Selection is now driven by the job's **content category** (chosen in
Create Video), not per-scene mood — one consistent musical theme per Short.
See `services/audio/contentCategory.ts` for the exact category→folder
mapping. The 7 real folders both Jamendo's search tags and your local
manifest's `mood` field should use:

```
motivation, curiosity, mystery, technology, emotional, energetic, general
```

A folder with no tracks (local) and no Jamendo match simply means no music
for videos in that category — a normal, valid state, not an error.

## What happens with the files

`services/audio/musicResolver.ts` tries Jamendo first, then this folder's
`LocalMusicProvider`, and picks a track deterministically (same track every
time for the same job+scene, so re-renders stay consistent).
`services/audio/audioMixer.ts` loops/trims the track to the scene's real
narration length, fades its edges, and mixes it under the narration with
real ducking (ffmpeg `sidechaincompress` — music genuinely dips while the
narrator is speaking).

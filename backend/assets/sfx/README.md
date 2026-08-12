# Sound effects library (Phase 6)

Same manifest-driven, license-honest convention as `assets/music/` — see
that folder's README for the full explanation. Organize by type, e.g.:

```
assets/sfx/
  whoosh/whoosh1.wav
  pop/pop1.wav
  reveal/reveal1.wav
```

`manifest.json`:
```json
{
  "sfx": [
    { "file": "whoosh/whoosh1.wav", "type": "whoosh", "source": "...", "license": "CC0" }
  ]
}
```

## Important — this is architecture-ready, not yet wired to a trigger

`services/audio/sfxProvider.ts` and `audioMixer.ts`'s SFX overlay are real
and tested, but **nothing in the pipeline currently decides which scene
should get which SFX** — the AI content engine doesn't yet produce a
per-scene "SFX intent" signal (unlike `musicMood`, which it already does).
Guessing when to play a sound effect without a real signal would mean
"random SFX on every scene," which the project's own principle explicitly
rules out ("never add random sound effects").

Populating this folder alone won't make sounds appear in your videos yet —
that needs a future phase to add a real per-scene SFX-intent field to the
AI schema (mirroring how `musicMood` was added) before this can be wired
in honestly.

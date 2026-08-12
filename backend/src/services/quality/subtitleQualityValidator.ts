/**
 * Caption/subtitle quality (Phase 9) — validates the real persisted cue
 * data (VideoScene.subtitles), the only subtitle artifact that actually
 * survives past rendering. Word-level kinetic-reveal timing (Phase 7's
 * computeWordTimings) is deliberately NOT re-validated here: it's a pure,
 * on-the-fly function of a cue's own [startSeconds,endSeconds] computed
 * fresh at render time, never persisted anywhere, so there is no separate
 * stored artifact to drift from what it was already derived from — its
 * own unit tests (remotion/layout/wordTiming.test.ts) are what guarantee
 * its invariants, and real rendered frames (inspected manually during
 * Phase 7 development) are what confirm it visually. Safe-zone placement
 * is likewise a structural property of safeZones.ts's fractions, not
 * per-video data — nothing scene-specific to check here either.
 */

import type { QualityCheckResult, QualityIssue, VideoScene } from "../../types/index.js";

const CUE_TOLERANCE_SECONDS = 0.1;

function normalise(word: string): string {
  return word.toLowerCase().replace(/[^a-z0-9%$£€.]/g, "");
}

export function validateSubtitleQuality(scenes: VideoScene[]): QualityCheckResult {
  const issues: QualityIssue[] = [];
  let cuesChecked = 0;

  for (const scene of scenes) {
    const hasNarration = scene.narration.trim().length > 0;
    const cues = scene.subtitles ?? [];

    if (hasNarration && cues.length === 0) {
      issues.push({ severity: "error", sceneId: scene.id, message: "Scene has narration but no subtitle cues." });
      continue;
    }

    const audioDuration = scene.audio?.duration;
    for (const cue of cues) {
      cuesChecked += 1;
      if (cue.startSeconds < 0) {
        issues.push({ severity: "error", sceneId: scene.id, message: `Cue ${cue.index} has a negative start time (${cue.startSeconds.toFixed(2)}s).` });
      }
      if (cue.endSeconds <= cue.startSeconds) {
        issues.push({ severity: "error", sceneId: scene.id, message: `Cue ${cue.index} ends at or before its own start (${cue.startSeconds.toFixed(2)}s → ${cue.endSeconds.toFixed(2)}s).` });
      }
      if (!cue.text.trim()) {
        issues.push({ severity: "error", sceneId: scene.id, message: `Cue ${cue.index} has empty text.` });
      }
      if (audioDuration != null && cue.endSeconds > audioDuration + CUE_TOLERANCE_SECONDS) {
        issues.push({
          severity: "error",
          sceneId: scene.id,
          message: `Cue ${cue.index} ends at ${cue.endSeconds.toFixed(2)}s, after the scene's own audio duration (${audioDuration.toFixed(2)}s).`,
        });
      }
    }

    // highlightWords sanity: every AI-provided emphasis word should
    // actually appear somewhere in this scene's own narration — a word
    // that doesn't will simply never highlight anything at render time
    // (DynamicCaption's isHighlighted only ever matches against cue text
    // drawn from this same narration), so it's a real, checkable defect.
    if (scene.highlightWords && scene.highlightWords.length > 0) {
      const narrationNormalised = normalise(scene.narration);
      for (const word of scene.highlightWords) {
        const wn = normalise(word);
        if (wn && !narrationNormalised.includes(wn)) {
          issues.push({ severity: "warn", sceneId: scene.id, message: `Highlight word "${word}" does not appear in this scene's narration.` });
        }
      }
    }
  }

  const hasError = issues.some((i) => i.severity === "error" || i.severity === "critical");
  const status = hasError ? "FAIL" : issues.length > 0 ? "WARN" : "PASS";

  return {
    status,
    details: { scenesChecked: scenes.length, cuesChecked },
    issues,
  };
}

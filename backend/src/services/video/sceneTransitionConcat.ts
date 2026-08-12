/**
 * Joins scene videos into one final MP4 with real cross-scene transitions
 * (Phase 8) — crossfades/pushes/zooms actually blend the tail of one
 * scene's already-rendered video into the head of the next, using
 * ffmpeg's own `xfade` (video) + `acrossfade` (audio) filters. Every scene
 * was already rendered by the same Remotion composition with identical
 * codec/resolution/fps (unchanged from Phase 5), so this only has to
 * handle combining them, never re-render a scene itself.
 *
 * Chained pairwise (scene1+scene2 -> intermediate, intermediate+scene3 ->
 * next intermediate, ...) rather than one giant filter_complex graph —
 * each step only ever reasons about two clips of known real duration,
 * which keeps the offset/duration math simple and easy to get right, at
 * the cost of re-encoding intermediate results for a job with 3+ scenes.
 * Deliberately not optimized further: typical Shorts run 2-6 scenes, so
 * the extra re-encoding is a few seconds of real video, not a bottleneck
 * worth a more complex single-pass graph (see README "Render performance
 * observations" for measured numbers).
 *
 * Audio is NOT mixed a second time here — each scene's own audio track is
 * already the fully-mixed narration+music+SFX file Phase 6 produced;
 * `acrossfade` blends those two already-finished tracks together exactly
 * like `xfade` blends the two already-finished video tracks, never
 * touching narration/music/SFX levels itself.
 */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { config } from "../../config/env.js";
import { runFfmpeg } from "../ffmpeg/ffmpegRunner.js";
import { concatSceneVideos } from "./videoConcat.js";
import type { SceneTransitionType } from "./sceneTransitionPlanner.js";

/**
 * ffmpeg's own default timeout (config.ffmpeg.processTimeoutMs, 120s) is
 * sized for a single quick operation — audio transcodes, the final
 * validation probe. This module's re-encodes get real work to do (an
 * xfade/concat over a growing cumulative clip, chained once per boundary),
 * so a job with several scenes and several real transitions can
 * legitimately take longer, especially with other renders competing for
 * CPU. Reuses the same generous ceiling already given to a full Remotion
 * scene render rather than inventing a new number.
 */
const TRANSITION_ENCODE_TIMEOUT_MS = config.rendering.renderTimeoutMs;

export interface SceneTransitionSpec {
  type: SceneTransitionType;
  durationSeconds: number;
}

export interface ConcatWithTransitionsResult {
  finalDurationSeconds: number;
}

/** ffmpeg's own built-in xfade transition names — verified against the vendored ffmpeg build (n7.1) via a real render, not assumed from docs alone. */
const XFADE_NAME: Partial<Record<SceneTransitionType, string>> = {
  crossfade: "fade",
  fade: "fadeblack",
  push_left: "slideleft",
  push_right: "slideright",
  push_up: "slideup",
  push_down: "slidedown",
  zoom: "zoomin",
  zoom_burst: "circleopen",
};

async function joinWithCut(inputA: string, inputB: string, outputPath: string): Promise<void> {
  await runFfmpeg([
    "-y",
    "-i", inputA,
    "-i", inputB,
    // Same timebase-normalization reasoning as joinWithBlend below — a cut
    // boundary can just as easily follow an earlier blend step in a mixed
    // chain, so inputA may already be an ffmpeg-re-encoded intermediate on
    // a different timebase than inputB's fresh-out-of-Remotion one.
    "-filter_complex",
    "[0:v]fps=30,settb=AVTB[v0];[1:v]fps=30,settb=AVTB[v1];[v0][0:a][v1][1:a]concat=n=2:v=1:a=1[v][a]",
    "-map", "[v]",
    "-map", "[a]",
    "-c:v", "libx264",
    "-c:a", "aac",
    "-pix_fmt", "yuv420p",
    outputPath,
  ], TRANSITION_ENCODE_TIMEOUT_MS);
}

async function joinWithBlend(inputA: string, inputB: string, durationA: number, spec: SceneTransitionSpec, outputPath: string): Promise<void> {
  const xfadeName = XFADE_NAME[spec.type] ?? "fade";
  const offset = Math.max(0, durationA - spec.durationSeconds);
  const d = spec.durationSeconds.toFixed(3);

  await runFfmpeg([
    "-y",
    "-i", inputA,
    "-i", inputB,
    "-filter_complex",
    // xfade requires both video inputs to share the same internal frame
    // timebase — a real, reproducible failure otherwise ("First input link
    // main timebase ... do not match the corresponding second input link
    // xfade timebase"). This bites specifically on a 3+ scene chain: the
    // previous step's re-encoded output (via ffmpeg's `concat` filter or
    // an earlier xfade) can land on a different timebase than a scene
    // fresh out of Remotion. `fps=30,settb=AVTB` normalizes both video
    // inputs onto a common timebase before they ever reach xfade,
    // regardless of which side of the chain they came from.
    `[0:v]fps=30,settb=AVTB[v0];[1:v]fps=30,settb=AVTB[v1];` +
      `[v0][v1]xfade=transition=${xfadeName}:duration=${d}:offset=${offset.toFixed(3)}[v];` +
      `[0:a][1:a]acrossfade=d=${d}[a]`,
    "-map", "[v]",
    "-map", "[a]",
    "-c:v", "libx264",
    "-c:a", "aac",
    "-pix_fmt", "yuv420p",
    outputPath,
  ], TRANSITION_ENCODE_TIMEOUT_MS);
}

/**
 * `sceneVideoPaths[i]` and `sceneDurations[i]` describe scene i; `transitions[i]`
 * describes the boundary between scene i and scene i+1, so
 * `transitions.length === sceneVideoPaths.length - 1`. When every boundary
 * is a plain "cut", this delegates straight to the existing fast
 * stream-copy `concatSceneVideos` — no re-encoding when nothing needs to
 * blend, exactly matching the pre-Phase-8 behavior for that case.
 */
export async function concatScenesWithTransitions(
  sceneVideoPaths: string[],
  sceneDurations: number[],
  transitions: SceneTransitionSpec[],
  outputPath: string
): Promise<ConcatWithTransitionsResult> {
  if (sceneVideoPaths.length === 0) {
    throw new Error("concatScenesWithTransitions requires at least one scene video.");
  }
  if (sceneVideoPaths.length !== sceneDurations.length) {
    throw new Error("sceneVideoPaths and sceneDurations must be the same length.");
  }
  if (transitions.length !== sceneVideoPaths.length - 1) {
    throw new Error(`Expected ${sceneVideoPaths.length - 1} transitions for ${sceneVideoPaths.length} scenes, got ${transitions.length}.`);
  }

  const totalDurationIfAllCuts = sceneDurations.reduce((a, b) => a + b, 0);

  if (sceneVideoPaths.length === 1 || transitions.every((t) => t.type === "cut" || t.durationSeconds <= 0)) {
    await concatSceneVideos(sceneVideoPaths, outputPath);
    return { finalDurationSeconds: totalDurationIfAllCuts };
  }

  const workDir = await mkdtemp(path.join(tmpdir(), "vidpilot-transitions-"));
  try {
    let currentPath = sceneVideoPaths[0];
    let currentDuration = sceneDurations[0];

    for (let i = 1; i < sceneVideoPaths.length; i++) {
      const spec = transitions[i - 1];
      const isLast = i === sceneVideoPaths.length - 1;
      const stepOutput = isLast ? outputPath : path.join(workDir, `step-${i}.mp4`);

      if (spec.type === "cut" || spec.durationSeconds <= 0) {
        await joinWithCut(currentPath, sceneVideoPaths[i], stepOutput);
        currentDuration = currentDuration + sceneDurations[i];
      } else {
        await joinWithBlend(currentPath, sceneVideoPaths[i], currentDuration, spec, stepOutput);
        currentDuration = currentDuration + sceneDurations[i] - spec.durationSeconds;
      }

      currentPath = stepOutput;
    }

    return { finalDurationSeconds: currentDuration };
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

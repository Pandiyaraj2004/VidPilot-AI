import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runFfmpeg, runFfprobe } from "../ffmpeg/ffmpegRunner.js";
import { makeTestVideo } from "./testFixtures.js";
import { concatScenesWithTransitions, type SceneTransitionSpec } from "./sceneTransitionConcat.js";

async function realDurationSeconds(filePath: string): Promise<number> {
  const stdout = await runFfprobe(["-v", "error", "-print_format", "json", "-show_format", filePath]);
  const parsed = JSON.parse(stdout) as { format?: { duration?: string } };
  return Number(parsed.format?.duration ?? 0);
}

describe("concatScenesWithTransitions (real ffmpeg)", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "vidpilot-transitions-test-"));
  });

  afterEach(() => {
    // Windows occasionally still holds a brief handle on a just-finished
    // ffmpeg output file (antivirus scan / delayed handle release) — this
    // suite's real libx264 re-encodes are heavier than videoConcat.test.ts's
    // plain stream-copy, so it surfaces here specifically. An orphaned temp
    // dir is harmless (same OS temp folder every other test already uses),
    // so a failed best-effort cleanup should never fail the test itself.
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore — see comment above
    }
  });

  it("throws when transitions.length doesn't match sceneVideoPaths.length - 1", async () => {
    const a = path.join(dir, "a.mp4");
    await makeTestVideo(a, { durationSeconds: 1 });
    await expect(concatScenesWithTransitions([a, a], [1, 1], [], path.join(dir, "out.mp4"))).rejects.toThrow();
  });

  it("throws on an empty scene list", async () => {
    await expect(concatScenesWithTransitions([], [], [], path.join(dir, "out.mp4"))).rejects.toThrow();
  });

  it("all-cut boundaries delegate to the fast stream-copy path and produce the naive summed duration", { timeout: 60000 }, async () => {
    const a = path.join(dir, "a.mp4");
    const b = path.join(dir, "b.mp4");
    await makeTestVideo(a, { durationSeconds: 2 });
    await makeTestVideo(b, { durationSeconds: 2 });
    const output = path.join(dir, "out.mp4");

    const cuts: SceneTransitionSpec[] = [{ type: "cut", durationSeconds: 0 }];
    const result = await concatScenesWithTransitions([a, b], [2, 2], cuts, output);

    expect(result.finalDurationSeconds).toBeCloseTo(4, 0);
    const real = await realDurationSeconds(output);
    expect(real).toBeGreaterThan(3.5);
  });

  it("a real crossfade shortens the combined output by roughly the transition duration", { timeout: 60000 }, async () => {
    const a = path.join(dir, "a.mp4");
    const b = path.join(dir, "b.mp4");
    await makeTestVideo(a, { durationSeconds: 3 });
    await makeTestVideo(b, { durationSeconds: 3 });
    const output = path.join(dir, "out.mp4");

    const spec: SceneTransitionSpec = { type: "crossfade", durationSeconds: 0.5 };
    const result = await concatScenesWithTransitions([a, b], [3, 3], [spec], output);

    // Two 3s clips overlapping by 0.5s -> ~5.5s, not the naive 6s a hard cut would give.
    expect(result.finalDurationSeconds).toBeCloseTo(5.5, 1);
    const real = await realDurationSeconds(output);
    expect(real).toBeGreaterThan(5.0);
    expect(real).toBeLessThan(6.0);
  });

  it("supports a 3-scene chain mixing a cut and a blend", { timeout: 180000 }, async () => {
    const a = path.join(dir, "a.mp4");
    const b = path.join(dir, "b.mp4");
    const c = path.join(dir, "c.mp4");
    await makeTestVideo(a, { durationSeconds: 2 });
    await makeTestVideo(b, { durationSeconds: 2 });
    await makeTestVideo(c, { durationSeconds: 2 });
    const output = path.join(dir, "out.mp4");

    const specs: SceneTransitionSpec[] = [
      { type: "cut", durationSeconds: 0 },
      { type: "fade", durationSeconds: 0.4 },
    ];
    const result = await concatScenesWithTransitions([a, b, c], [2, 2, 2], specs, output);

    // 2 + 2 + 2 - 0.4 (only the second boundary blends) = 5.6
    expect(result.finalDurationSeconds).toBeCloseTo(5.6, 1);
    const real = await realDurationSeconds(output);
    expect(real).toBeGreaterThan(5.0);
  });

  it.each([
    ["crossfade", 0.4],
    ["fade", 0.4],
    ["push_left", 0.3],
    ["push_right", 0.3],
    ["push_up", 0.3],
    ["push_down", 0.3],
    ["zoom", 0.3],
    ["zoom_burst", 0.3],
  ] as const)(
    "every real transition type '%s' renders without error against the actual ffmpeg build",
    { timeout: 60000 },
    async (type, durationSeconds) => {
      const a = path.join(dir, "a.mp4");
      const b = path.join(dir, "b.mp4");
      await makeTestVideo(a, { durationSeconds: 2 });
      await makeTestVideo(b, { durationSeconds: 2 });
      const output = path.join(dir, `out-${type}.mp4`);

      await expect(
        concatScenesWithTransitions([a, b], [2, 2], [{ type, durationSeconds }], output)
      ).resolves.toBeTruthy();
      const real = await realDurationSeconds(output);
      expect(real).toBeGreaterThan(1);
    }
  );

  it(
    "handles a scene whose container uses a different internal timebase than this module's own re-encodes (regression: real Remotion output uses timebase 15360, not ffmpeg's usual default — a 3+ scene chain feeds an already-re-encoded intermediate into a second xfade/concat step, and xfade fails outright if the two video inputs' timebases don't match)",
    { timeout: 180000 },
    async () => {
      const a = path.join(dir, "a.mp4");
      const bOddTimebase = path.join(dir, "b.mp4");
      const c = path.join(dir, "c.mp4");
      await makeTestVideo(a, { durationSeconds: 2 });
      await makeTestVideo(c, { durationSeconds: 2 });
      // Force a Remotion-like non-standard container timescale on this one
      // input — everything else in this suite uses makeTestVideo's default
      // (ordinary ffmpeg output), which never reproduces the real bug on
      // its own since both sides of every other test share the same
      // ffmpeg-default timebase throughout the chain.
      await runFfmpeg([
        "-y", "-f", "lavfi", "-i", "testsrc=size=1920x1080:rate=30:duration=2",
        "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-t", "2",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-video_track_timescale", "15360",
        "-c:a", "aac", "-shortest", bOddTimebase,
      ]);

      const output = path.join(dir, "out.mp4");
      const specs: SceneTransitionSpec[] = [
        { type: "cut", durationSeconds: 0 },
        { type: "fade", durationSeconds: 0.4 },
      ];

      // Would previously throw: "First input link main timebase ... do not
      // match the corresponding second input link xfade timebase".
      await expect(concatScenesWithTransitions([a, bOddTimebase, c], [2, 2, 2], specs, output)).resolves.toBeTruthy();
      const real = await realDurationSeconds(output);
      expect(real).toBeGreaterThan(3.0);
    }
  );

  it("a single scene with no boundaries at all just passes through", async () => {
    const a = path.join(dir, "a.mp4");
    await makeTestVideo(a, { durationSeconds: 2 });
    const output = path.join(dir, "out.mp4");

    const result = await concatScenesWithTransitions([a], [2], [], output);
    expect(result.finalDurationSeconds).toBeCloseTo(2, 0);
  });
});

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { runFfmpeg } from "../ffmpeg/ffmpegRunner.js";

/** ffmpeg's concat-demuxer list format requires single quotes around each path, with any literal `'` escaped as `'\''`. */
function concatListLine(filePath: string): string {
  const escaped = filePath.replace(/'/g, "'\\''");
  return `file '${escaped}'`;
}

/**
 * Joins every scene's already-rendered MP4 into one final file. Every scene
 * was rendered by the same Remotion composition with the same codec/
 * resolution/fps, so the concat demuxer can stream-copy (`-c copy`) instead
 * of re-encoding — fast, and lossless relative to the per-scene renders.
 */
export async function concatSceneVideos(sceneVideoPaths: string[], outputPath: string): Promise<void> {
  if (sceneVideoPaths.length === 0) {
    throw new Error("concatSceneVideos requires at least one scene video.");
  }

  const listDir = await mkdtemp(path.join(tmpdir(), "vidpilot-concat-"));
  const listFile = path.join(listDir, "list.txt");

  try {
    const listContent = sceneVideoPaths.map((p) => concatListLine(path.resolve(p))).join("\n");
    await writeFile(listFile, listContent, "utf-8");
    await runFfmpeg(["-y", "-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", outputPath]);
  } finally {
    await rm(listDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

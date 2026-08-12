import { runFfmpeg } from "../ffmpeg/ffmpegRunner.js";

/**
 * Synthesizes a tiny real MP4 via ffmpeg's lavfi test sources — no
 * Remotion/Chrome involved — so video-pipeline tests stay fast while still
 * exercising the real ffprobe/ffmpeg codepath.
 */
export async function makeTestVideo(
  outputPath: string,
  options: {
    width?: number;
    height?: number;
    durationSeconds?: number;
    videoCodec?: string;
    withAudio?: boolean;
    black?: boolean;
  } = {}
): Promise<void> {
  const { width = 1920, height = 1080, durationSeconds = 1, videoCodec = "libx264", withAudio = true, black = false } = options;
  const videoSource = black
    ? `color=c=black:size=${width}x${height}:rate=30:duration=${durationSeconds}`
    : `testsrc=size=${width}x${height}:rate=30:duration=${durationSeconds}`;

  const args = ["-y", "-f", "lavfi", "-i", videoSource];
  if (withAudio) {
    args.push("-f", "lavfi", "-i", `anullsrc=r=44100:cl=stereo`, "-t", String(durationSeconds));
  }
  args.push("-c:v", videoCodec, "-pix_fmt", "yuv420p");
  if (withAudio) args.push("-c:a", "aac", "-shortest");
  args.push(outputPath);

  await runFfmpeg(args, 30000);
}

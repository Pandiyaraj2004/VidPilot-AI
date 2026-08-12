import { stat } from "node:fs/promises";
import { config } from "../../config/env.js";
import { runFfmpegWithStderr, runFfprobe } from "../ffmpeg/ffmpegRunner.js";

export interface VideoMetadata {
  durationSeconds: number;
  width: number;
  height: number;
  fps: number;
  videoCodec: string;
  audioCodec: string;
  fileSizeBytes: number;
}

export interface VideoValidationResult {
  valid: boolean;
  errors: string[];
  metadata?: VideoMetadata;
}

interface ProbeStream {
  codec_type: string;
  codec_name: string;
  width?: number;
  height?: number;
  r_frame_rate?: string;
}

interface ProbeResult {
  streams: ProbeStream[];
  format: { duration?: string };
}

// Real audio duration is the source of truth; a scene's render can differ by
// a frame or two from rounding durationInSeconds to frames, and concatenation
// adds negligible overhead — this tolerance absorbs that without masking a
// genuinely wrong-length render.
const DURATION_TOLERANCE_SECONDS = 2;
// Only flags a render that is almost entirely black (a real rendering
// failure) — brief black frames during a transition are normal and expected.
const MAX_BLACK_FRACTION = 0.9;

async function probeVideo(filePath: string): Promise<ProbeResult> {
  const stdout = await runFfprobe(["-v", "error", "-print_format", "json", "-show_streams", "-show_format", filePath]);
  return JSON.parse(stdout) as ProbeResult;
}

function parseFrameRate(rate: string | undefined): number {
  if (!rate) return 0;
  const [num, den] = rate.split("/").map(Number);
  if (!den) return num ?? 0;
  return num / den;
}

/** Sums every blackdetect segment's duration and returns it as a fraction of the total. Best-effort: a parse miss just yields 0, never a false failure. */
async function blackFraction(filePath: string, totalDurationSeconds: number): Promise<number> {
  if (totalDurationSeconds <= 0) return 0;
  try {
    const { stderr } = await runFfmpegWithStderr([
      "-i",
      filePath,
      "-vf",
      "blackdetect=d=0.5:pic_th=0.98",
      "-an",
      "-f",
      "null",
      "-",
    ]);
    const matches = stderr.matchAll(/black_start:([\d.]+) black_end:([\d.]+)/g);
    let blackSeconds = 0;
    for (const m of matches) {
      blackSeconds += Number(m[2]) - Number(m[1]);
    }
    return blackSeconds / totalDurationSeconds;
  } catch {
    return 0;
  }
}

/**
 * Runs before a job is allowed to reach VIDEO_READY. Checks the render
 * actually produced a real, playable file — never trusts "ffmpeg exited 0"
 * alone. `expectedAudioDurationSeconds` should be the job's real total
 * narration duration (sum of scene audio.duration), never estimatedDuration.
 */
export async function validateVideoFile(
  filePath: string,
  expectedAudioDurationSeconds: number
): Promise<VideoValidationResult> {
  let fileStat;
  try {
    fileStat = await stat(filePath);
  } catch {
    return { valid: false, errors: ["Output video file does not exist or is not readable."] };
  }
  if (fileStat.size === 0) {
    return { valid: false, errors: ["Output video file is empty."] };
  }

  let probe: ProbeResult;
  try {
    probe = await probeVideo(filePath);
  } catch (err) {
    return { valid: false, errors: [`ffprobe failed: ${err instanceof Error ? err.message : String(err)}`] };
  }

  const errors: string[] = [];
  const videoStream = probe.streams.find((s) => s.codec_type === "video");
  const audioStream = probe.streams.find((s) => s.codec_type === "audio");

  if (!videoStream) errors.push("Output video has no video stream.");
  if (!audioStream) errors.push("Output video has no audio stream.");

  const durationSeconds = Number(probe.format.duration ?? 0);
  if (!durationSeconds || durationSeconds <= 0) {
    errors.push("Output video duration is zero or unknown.");
  } else if (Math.abs(durationSeconds - expectedAudioDurationSeconds) > DURATION_TOLERANCE_SECONDS) {
    errors.push(
      `Output video duration (${durationSeconds.toFixed(2)}s) does not match the narration audio duration (${expectedAudioDurationSeconds.toFixed(2)}s).`
    );
  }

  if (videoStream) {
    if (videoStream.width !== config.rendering.width || videoStream.height !== config.rendering.height) {
      errors.push(
        `Resolution ${videoStream.width}x${videoStream.height} does not match the expected ${config.rendering.width}x${config.rendering.height}.`
      );
    }
    if (videoStream.codec_name !== "h264") {
      errors.push(`Video codec is "${videoStream.codec_name}", expected h264.`);
    }
  }
  if (audioStream && audioStream.codec_name !== "aac") {
    errors.push(`Audio codec is "${audioStream.codec_name}", expected aac.`);
  }

  if (durationSeconds > 0) {
    const black = await blackFraction(filePath, durationSeconds);
    if (black >= MAX_BLACK_FRACTION) {
      errors.push("Output video is almost entirely black — the render likely failed.");
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    metadata: {
      durationSeconds,
      width: videoStream!.width!,
      height: videoStream!.height!,
      fps: parseFrameRate(videoStream!.r_frame_rate),
      videoCodec: videoStream!.codec_name,
      audioCodec: audioStream!.codec_name,
      fileSizeBytes: fileStat.size,
    },
  };
}

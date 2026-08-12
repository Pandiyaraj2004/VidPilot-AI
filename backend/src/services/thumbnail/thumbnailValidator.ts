import { stat } from "node:fs/promises";
import { runFfprobe } from "../ffmpeg/ffmpegRunner.js";

export interface ThumbnailValidationResult {
  valid: boolean;
  errors: string[];
  metadata?: {
    width: number;
    height: number;
    codec: string;
    fileSizeBytes: number;
  };
}

interface ProbeStream {
  codec_type: string;
  codec_name: string;
  width?: number;
  height?: number;
}

interface ProbeResult {
  streams: ProbeStream[];
}

const EXPECTED_WIDTH = 1280;
const EXPECTED_HEIGHT = 720;
// YouTube's own real, long-standing thumbnail upload limit.
const YOUTUBE_MAX_THUMBNAIL_BYTES = 2 * 1024 * 1024;
const MIN_PLAUSIBLE_BYTES = 1024; // Anything under 1KB for a real 1280x720 JPEG is almost certainly a corrupt/empty write, not a genuinely tiny valid image.

/**
 * Real image inspection via ffprobe (which decodes still images the same
 * way it probes video) — never "the file exists" alone. Run before a
 * thumbnail is ever handed to youtube.thumbnails.set.
 */
export async function validateThumbnail(filePath: string): Promise<ThumbnailValidationResult> {
  let fileStat;
  try {
    fileStat = await stat(filePath);
  } catch {
    return { valid: false, errors: ["Thumbnail file does not exist or is not readable."] };
  }
  if (fileStat.size === 0) {
    return { valid: false, errors: ["Thumbnail file is empty."] };
  }
  if (fileStat.size < MIN_PLAUSIBLE_BYTES) {
    return { valid: false, errors: [`Thumbnail file is only ${fileStat.size} bytes — too small to be a real image.`] };
  }
  if (fileStat.size > YOUTUBE_MAX_THUMBNAIL_BYTES) {
    return {
      valid: false,
      errors: [`Thumbnail is ${(fileStat.size / (1024 * 1024)).toFixed(2)}MB, over YouTube's ${YOUTUBE_MAX_THUMBNAIL_BYTES / (1024 * 1024)}MB limit.`],
    };
  }

  let probe: ProbeResult;
  try {
    const stdout = await runFfprobe(["-v", "error", "-print_format", "json", "-show_streams", filePath]);
    probe = JSON.parse(stdout) as ProbeResult;
  } catch (err) {
    return { valid: false, errors: [`Thumbnail could not be opened/decoded: ${err instanceof Error ? err.message : String(err)}`] };
  }

  const imageStream = probe.streams.find((s) => s.codec_type === "video");
  if (!imageStream) {
    return { valid: false, errors: ["Thumbnail has no readable image stream — file may be corrupted."] };
  }

  const errors: string[] = [];
  if (imageStream.width !== EXPECTED_WIDTH || imageStream.height !== EXPECTED_HEIGHT) {
    errors.push(`Thumbnail is ${imageStream.width}x${imageStream.height}, expected ${EXPECTED_WIDTH}x${EXPECTED_HEIGHT}.`);
  }
  if (imageStream.codec_name !== "mjpeg") {
    errors.push(`Thumbnail codec is "${imageStream.codec_name}", expected a JPEG (mjpeg).`);
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    metadata: {
      width: imageStream.width!,
      height: imageStream.height!,
      codec: imageStream.codec_name,
      fileSizeBytes: fileStat.size,
    },
  };
}

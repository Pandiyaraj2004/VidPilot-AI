import { runFfmpeg } from "../ffmpeg/ffmpegRunner.js";

/**
 * EdgeTtsProvider synthesises MP3; every downstream consumer (audioMetadata's
 * hand-rolled WAV parser, the Remotion <Audio> track, audioValidator) expects
 * canonical PCM WAV like Piper produces. Converting once here keeps that
 * contract uniform across providers instead of teaching every consumer two
 * audio formats.
 */
export async function transcodeToWav(inputPath: string, outputPath: string): Promise<void> {
  await runFfmpeg(["-y", "-i", inputPath, "-ar", "24000", "-ac", "1", "-sample_fmt", "s16", outputPath]);
}

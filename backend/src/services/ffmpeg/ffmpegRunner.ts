import { spawn } from "node:child_process";
import { config } from "../../config/env.js";

/** Message is safe to store/show — never a raw shell string, since args are always passed as an array. */
export class FfmpegError extends Error {}

interface ProcessOutput {
  stdout: string;
  stderr: string;
}

function runProcess(executablePath: string, args: string[], timeoutMs: number, toolName: string): Promise<ProcessOutput> {
  return new Promise((resolve, reject) => {
    const child = spawn(executablePath, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(new FfmpegError(`${toolName} timed out after ${timeoutMs}ms.`));
    }, timeoutMs);

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new FfmpegError(`Failed to start ${toolName}: ${err.message}`));
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new FfmpegError(`${toolName} exited with code ${code}. ${stderr.trim().slice(-800)}`));
      }
    });
  });
}

/** Args are always an array — never a shell string — so nothing in a file path can be interpreted as a shell command. */
export async function runFfmpeg(args: string[], timeoutMs: number = config.ffmpeg.processTimeoutMs): Promise<string> {
  return (await runProcess(config.ffmpeg.ffmpegPath, args, timeoutMs, "ffmpeg")).stdout;
}

export async function runFfprobe(args: string[], timeoutMs: number = config.ffmpeg.processTimeoutMs): Promise<string> {
  return (await runProcess(config.ffmpeg.ffprobePath, args, timeoutMs, "ffprobe")).stdout;
}

/** ffmpeg filters like blackdetect report their findings on stderr even on a successful (exit 0) run — the stdout-only helpers above can't see that. */
export async function runFfmpegWithStderr(args: string[], timeoutMs: number = config.ffmpeg.processTimeoutMs): Promise<ProcessOutput> {
  return runProcess(config.ffmpeg.ffmpegPath, args, timeoutMs, "ffmpeg");
}

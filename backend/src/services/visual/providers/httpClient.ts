import { createWriteStream } from "node:fs";
import { mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

/** Message is safe to store/show. */
export class VisualHttpError extends Error {}

/** Simple per-key min-interval gate — no queueing, just "wait if we called this key too recently." Good enough for a personal, single-job-at-a-time app; avoids a new dependency for something this small. */
const lastCallAt = new Map<string, number>();

export async function rateGate(key: string, minIntervalMs: number): Promise<void> {
  const last = lastCallAt.get(key) ?? 0;
  const wait = last + minIntervalMs - Date.now();
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  lastCallAt.set(key, Date.now());
}

export async function fetchJsonWithTimeout(url: string, timeoutMs: number, headers?: Record<string, string>): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, headers });
    if (!response.ok) {
      throw new VisualHttpError(`Request to ${new URL(url).hostname} failed with HTTP ${response.status}.`);
    }
    return await response.json();
  } catch (err) {
    if (err instanceof VisualHttpError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new VisualHttpError(`Request to ${new URL(url).hostname} timed out after ${timeoutMs}ms.`);
    }
    throw new VisualHttpError(`Request to ${new URL(url).hostname} failed: ${(err as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
}

/** Streams a remote file to disk. Never buffers the whole file in memory — video downloads can be several MB. */
export async function downloadToFile(url: string, destPath: string, timeoutMs: number): Promise<number> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok || !response.body) {
      throw new VisualHttpError(`Download from ${new URL(url).hostname} failed with HTTP ${response.status}.`);
    }
    await mkdir(path.dirname(destPath), { recursive: true });
    await pipeline(Readable.fromWeb(response.body as never), createWriteStream(destPath));
    const { size } = await stat(destPath);
    return size;
  } catch (err) {
    await rm(destPath, { force: true }).catch(() => undefined);
    if (err instanceof VisualHttpError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new VisualHttpError(`Download from ${new URL(url).hostname} timed out after ${timeoutMs}ms.`);
    }
    throw new VisualHttpError(`Download from ${new URL(url).hostname} failed: ${(err as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
}

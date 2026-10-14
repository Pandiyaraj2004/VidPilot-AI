import { createWriteStream } from "node:fs";
import { mkdir, rm, stat, rename } from "node:fs/promises";
import { randomUUID } from "node:crypto";
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

async function fetchJsonOnce(url: string, timeoutMs: number, headers?: Record<string, string>): Promise<unknown> {
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
async function downloadOnce(url: string, destPath: string, timeoutMs: number): Promise<number> {
  const partialPath=destPath+`.${randomUUID()}.part`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok || !response.body) {
      throw new VisualHttpError(`Download from ${new URL(url).hostname} failed with HTTP ${response.status}.`);
    }
    await mkdir(path.dirname(destPath), { recursive: true });
    await pipeline(Readable.fromWeb(response.body as never), createWriteStream(partialPath));
    const { size } = await stat(partialPath);
    if(size===0)throw new VisualHttpError("Provider returned an empty media download");
    await rename(partialPath,destPath);
    return size;
  } catch (err) {
    await rm(partialPath, { force: true }).catch(() => undefined);
    if (err instanceof VisualHttpError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new VisualHttpError(`Download from ${new URL(url).hostname} timed out after ${timeoutMs}ms.`);
    }
    throw new VisualHttpError(`Download from ${new URL(url).hostname} failed: ${(err as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
}

export async function withMediaRetry<T>(operation:()=>Promise<T>,sleep=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms))):Promise<T>{
 for(let attempt=0;;attempt++){try{return await operation();}catch(e){if(attempt>=2||/HTTP (400|401|403|404)/.test((e as Error).message))throw e;await sleep(250*2**attempt);}}
}
export function fetchJsonWithTimeout(url:string,timeoutMs:number,headers?:Record<string,string>){return withMediaRetry(()=>fetchJsonOnce(url,timeoutMs,headers));}
const unavailableDownloadHosts=new Map<string,number>();
export async function downloadToFile(url:string,destPath:string,timeoutMs:number){
 const host=new URL(url).hostname;
 if((unavailableDownloadHosts.get(host)??0)>Date.now())throw new VisualHttpError(`Download from ${host} is cooling down after repeated failures; try another source.`);
 try{const bytes=await withMediaRetry(()=>downloadOnce(url,destPath,timeoutMs));unavailableDownloadHosts.delete(host);return bytes;}
 catch(error){if(/timed out|fetch failed|HTTP (429|5\d\d)/i.test((error as Error).message))unavailableDownloadHosts.set(host,Date.now()+5*60_000);throw error;}
}

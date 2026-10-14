import { mkdir, readFile, rename, writeFile, open, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getSupabaseClient, isSupabaseConfigured } from "../supabase/index.js";
export class RuntimeState {
 constructor(private directory = process.env.STATE_DIR ?? path.join(process.cwd(), "data", "runtime")) {}
 private file(key: string) { return path.join(this.directory, Buffer.from(key).toString("hex") + ".json"); }
 async get<T>(key: string): Promise<T | null> {
  if (isSupabaseConfigured()) {
   const { data, error } = await getSupabaseClient().from("vidpilot_state").select("value").eq("key", key).maybeSingle();
   if (error) throw new Error(`State read failed: ${error.message}`);
   return data?.value as T ?? null;
  }
  try { return JSON.parse(await readFile(this.file(key), "utf8")) as T; }
  catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return null; throw e; }
 }
 async set(key: string, value: unknown): Promise<void> {
  if (isSupabaseConfigured()) {
   const { error } = await getSupabaseClient().from("vidpilot_state").upsert({key,value});
   if (error) throw new Error(`State write failed: ${error.message}`); return;
  }
  await mkdir(this.directory, {recursive:true});
  const temp = this.file(key) + "." + randomUUID();
  await writeFile(temp, JSON.stringify(value), {mode:0o600}); await rename(temp, this.file(key));
 }
 async claim(key: string, value: unknown): Promise<boolean> {
  if (isSupabaseConfigured()) {
   const {error} = await getSupabaseClient().from("vidpilot_state").insert({key,value});
   if (error?.code === "23505") return false;
   if (error) throw new Error(`State claim failed: ${error.message}`); return true;
  }
  await mkdir(this.directory,{recursive:true});
  try { const f=await open(this.file(key),"wx",0o600); try {await f.writeFile(JSON.stringify(value));} finally {await f.close();} return true; }
  catch(e) {if((e as NodeJS.ErrnoException).code === "EEXIST") return false; throw e;}
 }
 async remove(key: string): Promise<void> {
  if(isSupabaseConfigured()) { const {error}=await getSupabaseClient().from("vidpilot_state").delete().eq("key",key); if(error) throw new Error(error.message); return; }
  try {await unlink(this.file(key));} catch(e) {if((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;}
 }
}
export const runtimeState = new RuntimeState();

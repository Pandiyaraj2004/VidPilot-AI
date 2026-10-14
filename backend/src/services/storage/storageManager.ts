import { stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { getSupabaseClient, isSupabaseConfigured } from "../supabase/index.js";
export const STORAGE_LIMIT = 500_000_000;
export const STORAGE_WARNING = 450_000_000;
export const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export interface MediaObject { bucket:string; name:string; bytes:number; created_at:string; }
export function capacity(used:number,reserved:number,incoming:number):boolean {
 return [used,reserved,incoming].every(n=>Number.isSafeInteger(n)&&n>=0) && used+reserved+incoming<=STORAGE_LIMIT;
}
export function expired(createdAt:string,now=Date.now()):boolean {return Number.isFinite(Date.parse(createdAt)) && Date.parse(createdAt)+RETENTION_MS<=now;}
export class StorageManager {
 async usage() {
  if(!isSupabaseConfigured()) return {usedBytes:0,reservedBytes:0,limitBytes:STORAGE_LIMIT,warning:false,configured:false};
  const {data,error}=await getSupabaseClient().rpc("vidpilot_storage_usage");
  if(error) throw new Error(`Storage accounting unavailable; uploads blocked: ${error.message}`);
  return {...data,limitBytes:STORAGE_LIMIT,warning:data.usedBytes+data.reservedBytes>=STORAGE_WARNING,configured:true};
 }
 async inventory():Promise<MediaObject[]> {
  if(!isSupabaseConfigured()) return [];
  const objects:MediaObject[]=[];
  for(let offset=0;;offset+=1000){const {data,error}=await getSupabaseClient().rpc("vidpilot_inventory").range(offset,offset+999);
   if(error)throw new Error(`Storage inventory failed: ${error.message}`);objects.push(...data as MediaObject[]);if(data.length<1000)break;}
  return objects;
 }
 async upload(bucket:string,file:string,destination:string):Promise<string> {
  const original=await stat(file);const bytes=original.size;
  if(!capacity(0,0,bytes)) throw new Error("Object exceeds the 500 MB application limit");
  const {runCleanup}=await import("../maintenance/cleanup.js"); const usage=await this.usage();await runCleanup(usage.usedBytes+usage.reservedBytes+bytes>=STORAGE_WARNING);
  // Content-addressed immutable names prevent duplicate uploads and overwrites.
  const hash=createHash("sha256");for await(const chunk of createReadStream(file))hash.update(chunk);
  const current=await stat(file);
  if(current.size!==bytes||current.mtimeMs!==original.mtimeMs)throw new Error("Media file changed before storage reservation; retry after processing finishes");
  const digest=hash.digest("hex");
  const name=`vp1/${destination}/${digest}`;
  const client=getSupabaseClient();
  const {data,error}=await client.rpc("vidpilot_reserve",{p_bucket:bucket,p_name:name,p_bytes:bytes});
  if(error) throw new Error(`Storage reservation failed: ${error.message}`);
  if(data === "reserved") throw new Error("Object upload pending reconciliation; capacity remains reserved");
  if(data !== "exists") {
   const stream=createReadStream(file);let result;
   try{result=await client.storage.from(bucket).upload(name,stream,{upsert:false,duplex:"half"});}finally{stream.destroy();}
   // Preserve reservation on ambiguous network outcomes. Reconciliation/cleanup releases it only after verifying the object.
   if(result.error) throw new Error(`Storage upload failed; reservation retained: ${result.error.message}`);
  }
  const {error:releaseError}=await client.from("vidpilot_reservations").delete().eq("bucket",bucket).eq("name",name);
  if(releaseError) throw new Error(`Storage reservation reconciliation failed: ${releaseError.message}`);
  return name;
 }
 async remove(object:MediaObject):Promise<void> {
  // Inventory comes only from explicitly registered application-owned buckets.
  const known=(await this.inventory()).find(o=>o.bucket===object.bucket&&o.name===object.name&&o.created_at===object.created_at&&o.bytes===object.bytes);
  if(!known) return;
  const {error}=await getSupabaseClient().storage.from(object.bucket).remove([object.name]);
  if(error) throw new Error(`Delete ${object.bucket}/${object.name}: ${error.message}`);
 }
}
export const storageManager=new StorageManager();

import { readFile, readdir, lstat, writeFile, mkdir, unlink, rmdir } from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { LocalJobRepository } from "../jobs/localJobRepository.js";
import { jobRepository } from "../jobs/index.js";
import { runtimeState } from "../runtime/state.js";
import { storageManager, type MediaObject } from "../storage/storageManager.js";
import { isSupabaseConfigured, getSupabaseClient } from "../supabase/index.js";
import type { VideoJob } from "../../types/index.js";
import { Lease } from "../runtime/lease.js";
export interface ResetManifest { version:1; root:string; createdAt:string; localOnly:boolean; incomplete?:boolean; jobs:VideoJob[]; localJobs:VideoJob[]; files:{path:string;bytes:number;sha256:string;createdAt?:string}[]; directories?:string[]; objects:MediaObject[]; warnings:string[]; }
export async function hashFile(file:string):Promise<string>{const hash=createHash("sha256");for await(const chunk of createReadStream(file))hash.update(chunk);return hash.digest("hex");}
export async function verifiedOrphan(dir:string):Promise<boolean>{
 if(!/^[a-zA-Z0-9_-]+$/.test(path.basename(dir))||(await lstat(dir)).isSymbolicLink())return false;
 for(const name of await readdir(dir)){const sub=path.join(dir,name),s=await lstat(sub);if(s.isSymbolicLink()||!s.isDirectory()||!["audio","render","output"].includes(name))return false;
  for(const leaf of await readdir(sub)){const file=await lstat(path.join(sub,leaf));if(!file.isFile()||file.isSymbolicLink()||!(name==="audio"?/^[a-zA-Z0-9_-]+\.wav$/.test(leaf):name==="render"?/^[a-zA-Z0-9_-]+\.mp4$/.test(leaf):["final.mp4","final-with-transitions-TEST.mp4"].includes(leaf)))return false;}}
 return true;
}
export async function createResetManifest(localOnly=false,snapshot?:{jobs:VideoJob[];objects:MediaObject[]}):Promise<ResetManifest>{
 const root=path.resolve(process.cwd());const localJobs=(await new LocalJobRepository().listJobs()).filter(j=>!j.retentionManaged);
 const manifest:ResetManifest={version:1,root,createdAt:new Date().toISOString(),localOnly,jobs:localOnly?[]:snapshot?.jobs??await jobRepository.listJobs({limit:10000}),localJobs,files:[],directories:[],objects:[],warnings:[]};
 manifest.jobs=manifest.jobs.filter(j=>!j.retentionManaged);
 const ids=new Set([...manifest.jobs,...localJobs].map(j=>j.id));
 async function scan(dir:string):Promise<void>{
  try{if((await lstat(dir)).isSymbolicLink())throw new Error(`Symlink excluded: ${dir}`);
   manifest.directories?.push(dir);
   for(const name of await readdir(dir)){const file=path.join(dir,name),s=await lstat(file);if(s.isSymbolicLink()){manifest.incomplete=true;manifest.warnings.push(`Skipped symlink ${file}`);continue;}if(s.isDirectory())await scan(file);else if(s.isFile())manifest.files.push({path:file,bytes:s.size,sha256:await hashFile(file),createdAt:s.birthtime.toISOString()});}
  }catch(e){if((e as NodeJS.ErrnoException).code!=="ENOENT")throw e;}
 }
 const jobRoot=path.join(root,"storage","jobs");
 try{for(const id of await readdir(jobRoot)){
  if(ids.has(id)||await verifiedOrphan(path.join(jobRoot,id)))await scan(path.join(jobRoot,id));else{manifest.incomplete=true;manifest.warnings.push(`Unverified orphan left untouched: ${path.join(jobRoot,id)}`);}
 }}catch(e){if((e as NodeJS.ErrnoException).code!=="ENOENT")throw e;}
 // Dedicated cache paths are verified application roots, excluding symlinks.
 await scan(path.join(root,"storage","visual-cache"));await scan(path.join(root,"storage","jamendo-cache"));
 if(!localOnly)try{manifest.objects=(snapshot?.objects??await storageManager.inventory()).filter(o=>!o.name.startsWith("vp1/")&&Date.parse(o.created_at)<=Date.parse(manifest.createdAt));}catch(e){manifest.incomplete=true;manifest.warnings.push(`Cloud inventory incomplete; execution blocked: ${(e as Error).message}`);}
 return manifest;
}
export async function saveResetManifest(file:string,manifest:ResetManifest){await mkdir(path.dirname(path.resolve(file)),{recursive:true});await writeFile(file,JSON.stringify(manifest,null,2),{mode:0o600,flag:"wx"});}
export async function executeReset(manifest:ResetManifest,confirmation:string):Promise<void>{
 if(confirmation!=="DELETE_OLD_VIDPILOT_DATA")throw new Error("Explicit reset confirmation is required");
 const root=path.resolve(process.cwd());if(manifest.version!==1||manifest.root!==root)throw new Error("Manifest root mismatch");
 if(manifest.incomplete)throw new Error("Incomplete inventory cannot be executed; resolve warnings and create a new manifest");
 const worker=new Lease("worker"),cleaner=new Lease("cleanup");
 if(!await worker.acquire())throw new Error("Stop the active worker before reset");
 let cleanupHeld=false;
 try {
 cleanupHeld=await cleaner.acquire();if(!cleanupHeld)throw new Error("Cleanup is active; retry reset later");
 // Verify every path and byte fingerprint before deleting anything.
 for(const file of manifest.files){const target=path.resolve(file.path);if(!["jobs","visual-cache","jamendo-cache"].some(d=>target.startsWith(path.join(root,"storage",d)+path.sep)))throw new Error("Unowned reset path");
  await worker.assertHeld();await cleaner.assertHeld();
  let parent=target;while(parent!==root){if((await lstat(parent)).isSymbolicLink())throw new Error("Symlink reset path");parent=path.dirname(parent);}
  if(await hashFile(target)!==file.sha256)throw new Error(`File changed since manifest: ${target}`);
 }
 const local=new LocalJobRepository();
 for(const [repo,jobs] of [[local,manifest.localJobs],[jobRepository,manifest.jobs]] as const)for(const old of jobs){const current=await repo.getJob(old.id);if(current&&current.updatedAt!==old.updatedAt)throw new Error(`Job changed since manifest: ${old.id}`);}
 for(const job of [...manifest.localJobs,...manifest.jobs])if(job.youtubeVideoId)await runtimeState.set(`publication:${job.id}`,{status:"published",videoId:job.youtubeVideoId,createdAt:job.publishedAt});
 for(const object of manifest.objects){await worker.assertHeld();await cleaner.assertHeld();await storageManager.remove(object);}
 for(const file of manifest.files)await unlink(file.path);
 for(const dir of [...(manifest.directories??[])].sort((a,b)=>b.length-a.length)){const target=path.resolve(dir);if(!["jobs","visual-cache","jamendo-cache"].some(d=>target===path.join(root,"storage",d)||target.startsWith(path.join(root,"storage",d)+path.sep)))throw new Error("Unowned reset directory");try{await rmdir(target);}catch(e){if(!["ENOTEMPTY","ENOENT"].includes((e as NodeJS.ErrnoException).code??""))throw e;}}
 for(const job of manifest.localJobs)await local.deleteJob(job.id);
 for(const job of manifest.jobs)await jobRepository.deleteJob(job.id);
 const historyFile=path.join(root,"storage","automationHistory.json");
 try{const records=JSON.parse(await readFile(historyFile,"utf8")) as {timestamp:string}[];await writeFile(historyFile,JSON.stringify(records.filter(r=>r.timestamp>manifest.createdAt)));}catch(e){if((e as NodeJS.ErrnoException).code!=="ENOENT")throw e;}
 if(!manifest.localOnly&&isSupabaseConfigured()){const {error}=await getSupabaseClient().from("automation_history").delete().lte("data->>timestamp",manifest.createdAt);if(error)throw new Error(error.message);}
 await runtimeState.set("reset:last",{at:new Date().toISOString(),cutoff:manifest.createdAt,files:manifest.files.length,objects:manifest.objects.length});
 } finally {if(cleanupHeld)await cleaner.release();await worker.release();}
}

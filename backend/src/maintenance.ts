import "dotenv/config";
import { readFile } from "node:fs/promises";
import { createResetManifest,saveResetManifest,executeReset,type ResetManifest } from "./services/maintenance/reset.js";
import { runCleanup } from "./services/maintenance/cleanup.js";
const args=process.argv.slice(2);
const value=(key:string)=>args.find(a=>a.startsWith(key+"="))?.slice(key.length+1);
if(args[0]==="cleanup")console.log(JSON.stringify(await runCleanup(true)));
else if(args[0]==="reset-old-data"){
 const file=value("--manifest")??`reset-manifest-${Date.now()}.json`;
 if(args.includes("--execute")){
  if(process.env.MAINTENANCE_MODE!=="true")throw new Error("Stop all workers and set MAINTENANCE_MODE=true before reset");
  await executeReset(JSON.parse(await readFile(file,"utf8")) as ResetManifest,value("--confirm")??"");console.log("Reset completed. YouTube videos and credentials were preserved.");
 }else{const snapshotFile=value("--snapshot");const snapshot=snapshotFile?JSON.parse(await readFile(snapshotFile,"utf8")):undefined;if(snapshot&&(!Array.isArray(snapshot.jobs)||!Array.isArray(snapshot.objects)||!Number.isFinite(Date.parse(snapshot.capturedAt))||Date.now()-Date.parse(snapshot.capturedAt)>3600000))throw new Error("Use a verified database snapshot captured within the last hour");const manifest=await createResetManifest(args.includes("--local-only"),snapshot);await saveResetManifest(file,manifest);console.log(JSON.stringify({manifest:file,jobs:manifest.jobs.length,localJobs:manifest.localJobs.length,files:manifest.files.length,bytes:manifest.files.reduce((n,f)=>n+f.bytes,0),objects:manifest.objects,warnings:manifest.warnings},null,2));}
}else throw new Error("Use cleanup or reset-old-data [--local-only] [--manifest=path] [--execute --confirm=DELETE_OLD_VIDPILOT_DATA]");

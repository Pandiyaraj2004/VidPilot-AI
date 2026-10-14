import { narrationFitsTarget } from "../voice/durationPolicy.js";
import { access } from "node:fs/promises";
import type { VideoJob } from "../../types/index.js";
import * as jobs from "./jobService.js";
import { cleanupPublishedJob,cleanupFailedWorkspace } from "../maintenance/cleanup.js";
import { jobRepository } from "./index.js";
import { runtimeState } from "../runtime/state.js";
export const MAX_ATTEMPTS = 3;
export async function processPipeline(id: string, service = jobs): Promise<VideoJob> {
 let job = await service.getJobOrThrow(id);
 if (job.status === "published" || job.status === "cancelled") return job;
 if (job.youtube?.status === "uncertain" || job.status === "uploading") throw new Error("Upload outcome requires reconciliation; automatic re-upload is blocked.");
 if (!job.content) job = await service.processQueuedJob(id);
 if (job.voiceGeneration?.status !== "ready") job = await service.generateVoiceForJob(id);
 if (job.voiceGeneration?.status !== "ready") throw new Error(job.lastError ?? "Narration is incomplete; rendering and publishing are blocked.");
 const measured=job.voiceGeneration?.totalDurationSeconds??0;
 const cinematicManual=job.source==="manual"&&job.durationSeconds>=50&&job.durationSeconds<=60;
 if(job.voiceGeneration?.status === "ready" && (!narrationFitsTarget(measured,job.durationSeconds)||(cinematicManual&&(measured<52||measured>58)))) {
  const message=`Narration measured ${measured}s for a ${job.durationSeconds}s target. Rewrite the narration to fit ${cinematicManual?"52–57 seconds at natural 1.0x delivery":`${job.durationSeconds} seconds`}. Scale the spoken word count by approximately ${((cinematicManual?54.5:job.durationSeconds)/Math.max(measured,1)).toFixed(2)} from the previous script. Preserve required scenes and facts; never invent facts or speed up the voice.`;
  await jobRepository.updateJob(id,{status:"failed",lastError:message});
  if((job.attempts??0)<MAX_ATTEMPTS){const words=job.content?.scenes.reduce((n,s)=>n+s.narration.trim().split(/\s+/).length,0)??0;await service.regenerateScript(id,message,Math.round(words*(cinematicManual?54.5:job.durationSeconds)/Math.max(measured,1)));throw new Error(message+" Script repaired; narration will be retried.");}
  throw new Error(message);
 }
 if (job.videoRender?.status !== "ready") job = await service.renderVideoForJob(id);
 if (job.videoRender?.status !== "ready") throw new Error(job.lastError ?? "Video render is incomplete; publishing is blocked.");
 job = await service.runQualityCheckForJob(id);
 if (job.status !== "qc_passed" || job.qualityReport?.status !== "PASS") return job;
 const published=await service.uploadVideoForJob(id);
 try{await cleanupPublishedJob(id);}catch(e){console.error("Post-publication cleanup will retry:",e);}
 return published;
}
export async function processNextJob(): Promise<void> {
 const candidates = await jobRepository.listJobs({limit:1000});
 const interruptedStages=new Set(["generating_script","generating_voice","generating_visuals","generating_subtitles","rendering","video_validation","quality_check"]);
 for(let i=0;i<candidates.length;i++){
  const interrupted=candidates[i];
  if(interrupted.retentionManaged&&interruptedStages.has(interrupted.status)&&(interrupted.attempts??0)>=MAX_ATTEMPTS){
   const recoverable=(interrupted.restartRecoveries??0)<1;
   candidates[i]=await jobRepository.updateJob(interrupted.id,{status:"failed",attempts:recoverable?MAX_ATTEMPTS-1:MAX_ATTEMPTS,restartRecoveries:(interrupted.restartRecoveries??0)+1,nextAttemptAt:null,lastError:recoverable?"Recovering an interrupted final processing attempt.":"Processing was interrupted again; automatic restart recovery exhausted."});
  }
 }
 for(const pending of candidates.filter(j=>j.retentionManaged&&(j.status==="uploading"||j.youtube?.status==="uncertain"))) {
  const record=await runtimeState.get<{status:string;videoId?:string;createdAt:string}>(`publication:${pending.id}`);
  if(record?.status==="published"&&record.videoId)await jobRepository.updateJob(pending.id,{status:"published",publishedAt:record.createdAt,youtubeVideoId:record.videoId,youtube:{status:"uploaded",videoId:record.videoId,url:`https://www.youtube.com/watch?v=${record.videoId}`,uploadedAt:record.createdAt,privacyStatus:pending.youtubeVisibility,containsSyntheticMedia:true,lastError:null}});
  else await jobRepository.updateJob(pending.id,{status:"failed",lastError:"Interrupted upload: outcome requires reconciliation; automatic re-upload is blocked.",youtube:{status:"uncertain",videoId:null,url:null,uploadedAt:null,privacyStatus:pending.youtubeVisibility,containsSyntheticMedia:true,lastError:"Interrupted upload"}});
 }
 let job = candidates.reverse().find(j => j.retentionManaged && !["published","cancelled","uploading"].includes(j.status) &&
  j.youtube?.status !== "uncertain" && (j.attempts ?? 0) < MAX_ATTEMPTS &&
  (!j.nextAttemptAt || Date.parse(j.nextAttemptAt) <= Date.now()));
 if (!job) return;
 if(job.videoRender?.status==="ready"){
  const renderedPath=job.videoRender.path;
  if(!renderedPath||!/^https?:\/\//i.test(renderedPath)){
   try{if(!renderedPath)throw new Error("Missing final video path");await access(renderedPath);}
   catch{job=await jobRepository.updateJob(job.id,{videoRender:null,qualityReport:null});}
  }
 }
 if(job.videoRender?.status!=="ready"&&job.content){
  let missing=false;
  const scenes=await Promise.all(job.content.scenes.map(async scene=>{
   if(scene.audio?.status!=="ready")return scene;
   try{if(!scene.audio.path)throw new Error("Missing audio path");await access(scene.audio.path);return scene;}
   catch{missing=true;return {...scene,audio:{status:"failed" as const,error:"Temporary narration expired; regenerating it safely.",provider:scene.audio.provider}};}
  }));
  if(missing)job=await jobRepository.updateJob(job.id,{voiceGeneration:null,content:{...job.content,scenes}});
 }
 const resumeStatus = !job.content ? "queued" : job.voiceGeneration?.status !== "ready" ? "script_ready" : job.videoRender?.status !== "ready" ? "voice_ready" : "video_ready";
 await jobRepository.updateJob(job.id,{status:resumeStatus,attempts:(job.attempts ?? 0)+1,nextAttemptAt:null,lastError:null});
 try { await processPipeline(job.id); }
 catch(e) {
  const current=await jobRepository.getJob(job.id);
  if(current?.status !== "published" && current?.youtube?.status !== "uncertain")
   await jobRepository.updateJob(job.id,{status:"failed",lastError:(e as Error).message,nextAttemptAt:new Date(Date.now()+60_000 * 2**(job.attempts ?? 0)).toISOString()});
  else throw e;
 }finally{
  try{await cleanupFailedWorkspace(job.id);}catch(e){console.error("Temporary media cleanup will retry:",e);}
 }
}

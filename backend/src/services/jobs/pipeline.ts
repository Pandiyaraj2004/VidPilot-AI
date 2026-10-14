import { narrationFitsTarget } from "../voice/durationPolicy.js";
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
 if(job.voiceGeneration?.status === "ready" && !narrationFitsTarget(job.voiceGeneration.totalDurationSeconds??0,job.durationSeconds)) {
  const message=`Narration measured ${job.voiceGeneration.totalDurationSeconds}s for a ${job.durationSeconds}s target. Rewrite the narration to fit the target without inventing facts.`;
  await jobRepository.updateJob(id,{status:"failed",lastError:message});
  if((job.attempts??0)<MAX_ATTEMPTS){await service.regenerateScript(id,message);throw new Error(message+" Script repaired; narration will be retried.");}
  throw new Error(message);
 }
 if (job.videoRender?.status !== "ready") job = await service.renderVideoForJob(id);
 job = await service.runQualityCheckForJob(id);
 if (job.status !== "qc_passed" || job.qualityReport?.status !== "PASS") return job;
 const published=await service.uploadVideoForJob(id);
 try{await cleanupPublishedJob(id);}catch(e){console.error("Post-publication cleanup will retry:",e);}
 return published;
}
export async function processNextJob(): Promise<void> {
 const candidates = await jobRepository.listJobs({limit:1000});
 for(const pending of candidates.filter(j=>j.retentionManaged&&(j.status==="uploading"||j.youtube?.status==="uncertain"))) {
  const record=await runtimeState.get<{status:string;videoId?:string;createdAt:string}>(`publication:${pending.id}`);
  if(record?.status==="published"&&record.videoId)await jobRepository.updateJob(pending.id,{status:"published",publishedAt:record.createdAt,youtubeVideoId:record.videoId,youtube:{status:"uploaded",videoId:record.videoId,url:`https://www.youtube.com/watch?v=${record.videoId}`,uploadedAt:record.createdAt,privacyStatus:pending.youtubeVisibility,containsSyntheticMedia:true,lastError:null}});
  else await jobRepository.updateJob(pending.id,{status:"failed",lastError:"Interrupted upload: outcome requires reconciliation; automatic re-upload is blocked.",youtube:{status:"uncertain",videoId:null,url:null,uploadedAt:null,privacyStatus:pending.youtubeVisibility,containsSyntheticMedia:true,lastError:"Interrupted upload"}});
 }
 const job = candidates.reverse().find(j => j.retentionManaged && !["published","cancelled","uploading"].includes(j.status) &&
  j.youtube?.status !== "uncertain" && (j.attempts ?? 0) < MAX_ATTEMPTS &&
  (!j.nextAttemptAt || Date.parse(j.nextAttemptAt) <= Date.now()));
 if (!job) return;
 const resumeStatus = !job.content ? "queued" : job.voiceGeneration?.status !== "ready" ? "script_ready" : job.videoRender?.status !== "ready" ? "voice_ready" : "video_ready";
 await jobRepository.updateJob(job.id,{status:resumeStatus,attempts:(job.attempts ?? 0)+1,nextAttemptAt:null});
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

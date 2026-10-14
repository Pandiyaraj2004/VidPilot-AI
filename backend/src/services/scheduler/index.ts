import { SchedulerConfigRepository } from "./schedulerConfigRepository.js";
import { AutomationHistory } from "./automationHistory.js";
import { SchedulerLock } from "./schedulerLock.js";
import { selectNextVariation } from "./variationEngine.js";
import { createJob } from "../jobs/jobService.js";
import { processNextJob } from "../jobs/pipeline.js";
import { VOICE_OPTIONS } from "../voice/voiceConfig.js";
import { Lease } from "../runtime/lease.js";
import { jobRepository } from "../jobs/index.js";
import { recordWorker } from "../runtime/workerStatus.js";
import {youtubeProvider} from "../youtube/index.js";
import { runCleanup, cleanupPublishedJob } from "../maintenance/cleanup.js";
import type { SchedulerConfig } from "../../types/index.js";
export function validateSchedulerConfig(patch: Partial<SchedulerConfig>): void {
  if (patch.intervalHours !== undefined) {
    if (typeof patch.intervalHours !== "number" || patch.intervalHours < 1) {
      throw new Error("Interval hours must be a positive number.");
    }
  }

  if (patch.timezone !== undefined) {
    if (typeof patch.timezone !== "string") {
      throw new Error("Timezone must be a string.");
    }
    try {
      Intl.DateTimeFormat(undefined, { timeZone: patch.timezone });
    } catch {
      throw new Error(`Invalid timezone: ${patch.timezone}`);
    }
  }

  if (patch.minDurationSeconds !== undefined) {
    if (typeof patch.minDurationSeconds !== "number" || patch.minDurationSeconds < 10) {
      throw new Error("minDurationSeconds must be a number >= 10.");
    }
  }

  if (patch.maxDurationSeconds !== undefined) {
    if (typeof patch.maxDurationSeconds !== "number" || patch.maxDurationSeconds > 300) {
      throw new Error("maxDurationSeconds must be a number <= 300.");
    }
  }

  if (patch.minDurationSeconds !== undefined && patch.maxDurationSeconds !== undefined) {
    if (patch.minDurationSeconds > patch.maxDurationSeconds) {
      throw new Error("minDurationSeconds cannot be greater than maxDurationSeconds.");
    }
  }

  if (patch.languages !== undefined) {
    if (!Array.isArray(patch.languages) || patch.languages.length === 0) {
      throw new Error("languages must be a non-empty array of strings.");
    }
    const supported = ["en", "ta", "hi"];
    for (const lang of patch.languages) {
      if (!supported.includes(lang)) {
        throw new Error(`Unsupported language: ${lang}`);
      }
    }
  }

  if (patch.enabledVoices !== undefined) {
    if (!Array.isArray(patch.enabledVoices) || patch.enabledVoices.length === 0) {
      throw new Error("enabledVoices must be a non-empty array of strings.");
    }
    const validVoiceIds = VOICE_OPTIONS.map((v) => v.id);
    for (const voiceId of patch.enabledVoices) {
      if (!validVoiceIds.includes(voiceId)) {
        throw new Error(`Invalid voice ID: ${voiceId}`);
      }
    }
  }

  if (patch.contentCategories !== undefined) {
    if (!Array.isArray(patch.contentCategories) || patch.contentCategories.length === 0) {
      throw new Error("contentCategories must be a non-empty array.");
    }
    const validCategories = [
      "science", "general_knowledge", "technology", "history", "mystery",
      "motivation", "facts", "space", "ai", "business", "psychology", "story", "news"
    ];
    for (const cat of patch.contentCategories) {
      if (!validCategories.includes(cat)) {
        throw new Error(`Invalid content category: ${cat}`);
      }
    }
  }


  if (patch.youtubeVisibility !== undefined) {
    const validVisibility = ["private", "unlisted", "public"];
    if (!validVisibility.includes(patch.youtubeVisibility)) {
      throw new Error(`Invalid YouTube visibility: ${patch.youtubeVisibility}`);
    }
  }
}


export class SchedulerService {
 readonly configRepo=new SchedulerConfigRepository(); readonly history=new AutomationHistory(); readonly lock=new SchedulerLock();
 private timer:ReturnType<typeof setInterval>|null=null; private busy=false;
 async getConfig() {return this.configRepo.get();}
 async updateConfig(patch:Partial<SchedulerConfig>) {
  const current=await this.getConfig(); const merged={...current,...patch}; validateSchedulerConfig(merged);
  if(merged.minDurationSeconds>merged.maxDurationSeconds) throw new Error("Minimum duration exceeds maximum");
  if(!Number.isFinite(merged.intervalHours)||merged.intervalHours<1||merged.intervalHours>168) throw new Error("Interval must be 1–168 hours");
  if(patch.automationEnabled && !current.automationEnabled || patch.intervalHours!==undefined)
   merged.nextGenerationAt=new Date(Date.now()+merged.intervalHours*3600000).toISOString();
  if(!merged.automationEnabled) merged.nextGenerationAt=null;
  return this.configRepo.set(merged);
 }
 startLoop() {if(this.timer)return; this.timer=setInterval(()=>void this.tick().catch(e=>console.error("Worker:",e)),30000);this.timer.unref();void this.tick().catch(e=>console.error("Worker:",e));}
 stopLoop() {if(this.timer)clearInterval(this.timer);this.timer=null;}
 async runPipeline() {
  const c=await this.getConfig();
  const v=selectNextVariation(c.contentCategories,c.languages,c.enabledVoices,await this.history.read(),c.minDurationSeconds,c.maxDurationSeconds,c.defaultStyle);
  const job=await createJob({topic:v.topic,style:v.style,contentCategory:v.category,durationSeconds:v.durationSeconds,language:v.language,voiceId:v.voiceId,voiceSpeed:1,visualStyle:"cinematic",subtitlesEnabled:true,youtubeVisibility:c.youtubeVisibility,source:"scheduled"});
  await this.history.record({eventType:"job_created",jobId:job.id,topic:v.topic,category:v.category,language:v.language,voice:v.voiceId,style:v.style,targetDuration:v.durationSeconds});
  return job;
 }
 async triggerIfDue() {
  const c=await this.getConfig();if(!c.automationEnabled)return;
  if(!c.nextGenerationAt){await this.configRepo.set({...c,nextGenerationAt:new Date(Date.now()+c.intervalHours*3600000).toISOString()});return;}
  if(Date.parse(c.nextGenerationAt)>Date.now())return;
  if(!await this.lock.acquire(`slot:${c.nextGenerationAt}`))return;
  // Persist next slot before generation so a restart cannot enqueue it twice.
  await this.configRepo.set({...c,lastGenerationAt:new Date().toISOString(),nextGenerationAt:new Date(Date.now()+c.intervalHours*3600000).toISOString()});
  await this.runPipeline();
 }
 async tick() {
  if(this.busy)return;this.busy=true;const lease=new Lease("worker");let held=false;let heartbeat:ReturnType<typeof setInterval>|undefined;
  try {
   held=await lease.acquire();if(!held)return;
   await recordWorker("processing");
   heartbeat=setInterval(()=>{void lease.assertHeld().then(()=>recordWorker("processing")).catch(e=>{console.error("Worker lease renewal failed; stopping:",e);process.exit(1);});},30000);
   await runCleanup();
   for(const j of await jobRepository.listJobs({status:"published",limit:1000}))try{await cleanupPublishedJob(j.id);}catch(e){console.error("Cleanup retry:",e);}
   await this.triggerIfDue();
   if(!await youtubeProvider.isConnected()){await recordWorker("error","Reconnect YouTube once in Settings to resume automatic publishing.");return;}
   await processNextJob();
   await recordWorker("idle");
  }catch(e){if(held)await recordWorker("error",(e as Error).message).catch(()=>undefined);throw e;
  }finally{if(heartbeat)clearInterval(heartbeat);if(held)await lease.release();this.busy=false;}
 }
}
let singleton:SchedulerService|undefined;
export function getSchedulerService(){return singleton??=new SchedulerService();}

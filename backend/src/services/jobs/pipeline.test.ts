import {beforeEach,expect,it,vi} from "vitest";
import {processPipeline} from "./pipeline.js";
import type * as jobs from "./jobService.js";
import type {VideoJob} from "../../types/index.js";
vi.mock("../maintenance/cleanup.js",()=>({cleanupPublishedJob:vi.fn()}));
let job:VideoJob;
beforeEach(()=>{job={id:"test",status:"queued",durationSeconds:30,content:null,voiceGeneration:null,videoRender:null} as VideoJob;});
function fake(status:"PASS"|"WARN"|"FAIL"){
 const service={getJobOrThrow:vi.fn(async()=>job),processQueuedJob:vi.fn(async()=>job={...job,content:{scenes:[]} as unknown as VideoJob['content'],status:"script_ready"}),generateVoiceForJob:vi.fn(async()=>job={...job,voiceGeneration:{status:"ready",totalDurationSeconds:30,provider:"piper",generatedAt:"now"},status:"voice_ready"}),renderVideoForJob:vi.fn(async()=>job={...job,videoRender:{status:"ready"} as VideoJob['videoRender'],status:"video_ready"}),runQualityCheckForJob:vi.fn(async()=>job={...job,status:status==="PASS"?"qc_passed":"failed",qualityReport:{status} as VideoJob['qualityReport']}),uploadVideoForJob:vi.fn(async()=>job={...job,status:"published"})};return service;
}
it("runs manual/scheduled production through QC PASS to automatic upload",async()=>{const service=fake("PASS");expect((await processPipeline("test",service as unknown as typeof jobs)).status).toBe("published");expect(service.uploadVideoForJob).toHaveBeenCalledTimes(1);});
it.each(["WARN","FAIL"] as const)("never publishes QC %s",async status=>{const service=fake(status);await processPipeline("test",service as unknown as typeof jobs);expect(service.uploadVideoForJob).not.toHaveBeenCalled();});
it("does not re-upload a published job",async()=>{job.status="published";const service=fake("PASS");await processPipeline("test",service as unknown as typeof jobs);expect(service.uploadVideoForJob).not.toHaveBeenCalled();});
it("blocks an uncertain previous upload",async()=>{job.youtube={status:"uncertain"} as VideoJob['youtube'];const service=fake("PASS");await expect(processPipeline("test",service as unknown as typeof jobs)).rejects.toThrow("reconciliation");expect(service.uploadVideoForJob).not.toHaveBeenCalled();});

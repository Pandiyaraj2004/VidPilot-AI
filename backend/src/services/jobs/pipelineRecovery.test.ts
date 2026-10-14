import {beforeEach,expect,it,vi} from "vitest";
import type {VideoJob} from "../../types/index.js";
const state=vi.hoisted(()=>({job:null as VideoJob|null}));
vi.mock("./index.js",()=>({jobRepository:{listJobs:vi.fn(async()=>[state.job]),getJob:vi.fn(async()=>state.job),updateJob:vi.fn(async(_id,patch)=>state.job={...state.job,...patch} as VideoJob)}}));
vi.mock("../runtime/state.js",()=>({runtimeState:{get:vi.fn(async()=>null)}}));
vi.mock("../maintenance/cleanup.js",()=>({cleanupPublishedJob:vi.fn(),cleanupFailedWorkspace:vi.fn()}));
vi.mock("./jobService.js",()=>({getJobOrThrow:vi.fn(async()=>state.job),generateVoiceForJob:vi.fn(async()=>state.job={...state.job,voiceGeneration:{status:"ready",totalDurationSeconds:30}} as VideoJob),renderVideoForJob:vi.fn(async()=>state.job={...state.job,videoRender:{status:"ready"}} as VideoJob),runQualityCheckForJob:vi.fn(async()=>state.job={...state.job,status:"failed",qualityReport:{status:"FAIL"}} as VideoJob),uploadVideoForJob:vi.fn()}));
import {processNextJob} from "./pipeline.js";
import {generateVoiceForJob,renderVideoForJob,uploadVideoForJob} from "./jobService.js";
beforeEach(()=>{vi.clearAllMocks();state.job={id:"recovery",retentionManaged:true,status:"generating_voice",attempts:3,source:"scheduled",durationSeconds:30,content:{scenes:[]},voiceGeneration:null,videoRender:null} as unknown as VideoJob;});
it("recovers an interrupted final attempt once without uploading failed QC",async()=>{
 await processNextJob();expect(state.job).toMatchObject({restartRecoveries:1,attempts:3,status:"failed"});expect(generateVoiceForJob).toHaveBeenCalledOnce();expect(uploadVideoForJob).not.toHaveBeenCalled();
 await processNextJob();expect(generateVoiceForJob).toHaveBeenCalledOnce();
});
it("regenerates an unpublished final video when cleanup removed its local file",async()=>{
 state.job={...state.job,status:"failed",attempts:0,voiceGeneration:{status:"ready",totalDurationSeconds:30},videoRender:{status:"ready",path:`${process.env.STATE_DIR}/missing-final.mp4`}} as VideoJob;
 await processNextJob();expect(renderVideoForJob).toHaveBeenCalledOnce();expect(uploadVideoForJob).not.toHaveBeenCalled();
});

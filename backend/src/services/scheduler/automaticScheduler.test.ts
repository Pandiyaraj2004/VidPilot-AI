import {beforeEach,describe,expect,it,vi} from "vitest";
import {SchedulerService,validateSchedulerConfig} from "./index.js";
import {createJob} from "../jobs/jobService.js";
import type {SchedulerConfig} from "../../types/index.js";
vi.mock("../jobs/jobService.js",()=>({createJob:vi.fn().mockResolvedValue({id:"new-job"})}));
vi.mock("../jobs/pipeline.js",()=>({processNextJob:vi.fn()}));
describe("automatic scheduler",()=>{
 let scheduler:SchedulerService;let config:SchedulerConfig;
 beforeEach(()=>{scheduler=new SchedulerService();config={automationEnabled:true,intervalHours:4,defaultStyle:"explainer",defaultDurationSeconds:35,youtubeVisibility:"private",lastGenerationAt:null,nextGenerationAt:new Date(Date.now()-1000).toISOString(),minDurationSeconds:30,maxDurationSeconds:45,languages:["en"],enabledVoices:["en_US-amy-medium"],contentCategories:["science"],lastJobId:null,timezone:"UTC",defaultLanguage:"en",updatedAt:new Date().toISOString()};
 vi.spyOn(scheduler.configRepo,"get").mockImplementation(async()=>config);vi.spyOn(scheduler.configRepo,"set").mockImplementation(async c=>(config=c));vi.spyOn(scheduler.history,"read").mockResolvedValue([]);vi.spyOn(scheduler.history,"record").mockResolvedValue();vi.spyOn(scheduler.lock,"acquire").mockResolvedValue(true);vi.mocked(createJob).mockClear();});
 it("creates one due job and advances the durable slot",async()=>{await scheduler.triggerIfDue();await scheduler.triggerIfDue();expect(createJob).toHaveBeenCalledTimes(1);expect(Date.parse(config.nextGenerationAt!)).toBeGreaterThan(Date.now());});
 it("does not enqueue while paused",async()=>{config.automationEnabled=false;await scheduler.triggerIfDue();expect(createJob).not.toHaveBeenCalled();});
 it("does not enqueue when another worker claimed the slot",async()=>{vi.mocked(scheduler.lock.acquire).mockResolvedValue(false);await scheduler.triggerIfDue();expect(createJob).not.toHaveBeenCalled();});
 it("reports database lock failures",async()=>{vi.mocked(scheduler.lock.acquire).mockRejectedValue(new Error("database unavailable"));await expect(scheduler.triggerIfDue()).rejects.toThrow("database unavailable");expect(createJob).not.toHaveBeenCalled();});
 it("uses the selected voice, category and visibility without approval",async()=>{await scheduler.runPipeline();expect(createJob).toHaveBeenCalledWith(expect.objectContaining({language:"en",contentCategory:"science",youtubeVisibility:"private"}));expect(vi.mocked(createJob).mock.calls[0][0]).not.toHaveProperty("approvalRequired");});
 it("validates durations against merged settings",async()=>{await expect(scheduler.updateConfig({minDurationSeconds:60})).rejects.toThrow();});
 it("rejects invalid voices, timezones and intervals",()=>{expect(()=>validateSchedulerConfig({enabledVoices:["missing"]})).toThrow();expect(()=>validateSchedulerConfig({timezone:"not-a-zone"})).toThrow();expect(()=>validateSchedulerConfig({intervalHours:0})).toThrow();});
});

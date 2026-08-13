import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { SchedulerService } from "./index.js";
import type { SchedulerConfigRepository as _SchedulerConfigRepository } from "./schedulerConfigRepository.js";
import type { AutomationHistory as _AutomationHistory } from "./automationHistory.js";
import type { SchedulerLock as _SchedulerLock } from "./schedulerLock.js";
import * as jobService from "../jobs/jobService.js";
import * as sendApproval from "../telegram/sendApproval.js";
import { jobRepository } from "../jobs/index.js";
import type { SchedulerConfig } from "../../types/index.js";

vi.mock("./schedulerConfigRepository.js");
vi.mock("./automationHistory.js");
vi.mock("./schedulerLock.js");
vi.mock("../jobs/jobService.js");
vi.mock("../telegram/sendApproval.js");
vi.mock("../jobs/index.js", () => ({
  jobRepository: {
    listJobs: vi.fn(),
    updateJob: vi.fn(),
  },
}));

describe("SchedulerService", () => {
  let scheduler: SchedulerService;
  let mockConfigRepo: any;
  let mockHistory: any;
  let mockLock: any;

  beforeEach(() => {
    vi.useFakeTimers();
    scheduler = new SchedulerService();

    mockConfigRepo = {
      get: vi.fn(),
      set: vi.fn(),
    };
    vi.spyOn(scheduler.configRepo, "get").mockImplementation(mockConfigRepo.get);
    vi.spyOn(scheduler.configRepo, "set").mockImplementation(mockConfigRepo.set);

    mockHistory = {
      read: vi.fn().mockResolvedValue([]),
      record: vi.fn().mockResolvedValue(undefined),
    };
    vi.spyOn(scheduler.history, "read").mockImplementation(mockHistory.read);
    vi.spyOn(scheduler.history, "record").mockImplementation(mockHistory.record);

    mockLock = {
      acquire: vi.fn().mockResolvedValue(true),
    };
    vi.spyOn(scheduler.lock, "acquire").mockImplementation(mockLock.acquire);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    scheduler.stopLoop();
  });

  it("returns stored configuration", async () => {
    const config: SchedulerConfig = {
      automationEnabled: false,
      intervalHours: 4,
      defaultStyle: "explainer",
      defaultDurationSeconds: 35,
      requireApproval: true,
      youtubeVisibility: "public",
      lastGenerationAt: null,
      nextGenerationAt: null,
      minDurationSeconds: 30,
      maxDurationSeconds: 45,
      languages: ["en"],
      enabledVoices: ["en_US-amy-medium"],
      contentCategories: ["science"],
      lastJobId: null,
      timezone: "UTC",
      defaultLanguage: "en",
      updatedAt: "",
    };
    mockConfigRepo.get.mockResolvedValue(config);

    const result = await scheduler.getConfig();
    expect(result).toEqual(config);
  });

  it("calculates nextGenerationAt when enabled and starts the checker loop", async () => {
    const config: SchedulerConfig = {
      automationEnabled: false,
      intervalHours: 4,
      defaultStyle: "explainer",
      defaultDurationSeconds: 35,
      requireApproval: true,
      youtubeVisibility: "public",
      lastGenerationAt: null,
      nextGenerationAt: null,
      minDurationSeconds: 30,
      maxDurationSeconds: 45,
      languages: ["en"],
      enabledVoices: ["en_US-amy-medium"],
      contentCategories: ["science"],
      lastJobId: null,
      timezone: "UTC",
      defaultLanguage: "en",
      updatedAt: "",
    };
    mockConfigRepo.get.mockResolvedValue(config);
    mockConfigRepo.set.mockImplementation((c: any) => Promise.resolve(c));

    const result = await scheduler.updateConfig({ automationEnabled: true });
    expect(result.automationEnabled).toBe(true);
    expect(result.nextGenerationAt).not.toBeNull();
  });

  it("triggerIfDue creates job and calculates next run time to prevent drift", async () => {
    const nextRunTime = new Date().toISOString();
    const config: SchedulerConfig = {
      automationEnabled: true,
      intervalHours: 4,
      defaultStyle: "explainer",
      defaultDurationSeconds: 35,
      requireApproval: true,
      youtubeVisibility: "public",
      lastGenerationAt: null,
      nextGenerationAt: nextRunTime,
      minDurationSeconds: 30,
      maxDurationSeconds: 45,
      languages: ["en"],
      enabledVoices: ["en_US-amy-medium"],
      contentCategories: ["science"],
      lastJobId: null,
      timezone: "UTC",
      defaultLanguage: "en",
      updatedAt: "",
    };
    mockConfigRepo.get.mockResolvedValue(config);
    mockConfigRepo.set.mockImplementation((c: any) => Promise.resolve(c));

    const createdJob = { id: "job-123", status: "queued" };
    (jobService.createJob as any).mockResolvedValue(createdJob);
    (jobService.processQueuedJob as any).mockResolvedValue({ content: {} });
    (jobService.generateVoiceForJob as any).mockResolvedValue({});
    (jobService.renderVideoForJob as any).mockResolvedValue({ videoRender: { durationSeconds: 32 } });
    (jobService.runQualityCheckForJob as any).mockResolvedValue({ videoRender: { durationSeconds: 32 } });
    (sendApproval.sendApprovalRequestForJob as any).mockResolvedValue({});

    const triggered = await scheduler.triggerIfDue();
    expect(triggered).toBe(true);
    expect(mockConfigRepo.set).toHaveBeenCalled();

    // Verify next run is calculated precisely by adding 4 hours to the scheduled run time
    const updatedCall = mockConfigRepo.set.mock.calls[0][0];
    const expectedNext = new Date(new Date(nextRunTime).getTime() + 4 * 60 * 60 * 1000).toISOString();
    expect(updatedCall.nextGenerationAt).toBe(expectedNext);
  });

  it("triggerIfDue auto-approves and uploads directly when requireApproval is false", async () => {
    const nextRunTime = new Date().toISOString();
    const config: SchedulerConfig = {
      automationEnabled: true,
      intervalHours: 4,
      defaultStyle: "explainer",
      defaultDurationSeconds: 35,
      requireApproval: false,
      youtubeVisibility: "public",
      lastGenerationAt: null,
      nextGenerationAt: nextRunTime,
      minDurationSeconds: 30,
      maxDurationSeconds: 45,
      languages: ["en"],
      enabledVoices: ["en_US-amy-medium"],
      contentCategories: ["science"],
      lastJobId: null,
      timezone: "UTC",
      defaultLanguage: "en",
      updatedAt: "",
    };
    mockConfigRepo.get.mockResolvedValue(config);
    mockConfigRepo.set.mockImplementation((c: any) => Promise.resolve(c));

    const createdJob = { id: "job-456", status: "queued" };
    (jobService.createJob as any).mockResolvedValue(createdJob);
    (jobService.processQueuedJob as any).mockResolvedValue({ content: {} });
    (jobService.generateVoiceForJob as any).mockResolvedValue({});
    (jobService.renderVideoForJob as any).mockResolvedValue({ videoRender: { durationSeconds: 32 } });
    (jobService.runQualityCheckForJob as any).mockResolvedValue({ id: "job-456", status: "ready", renderVersion: 1, videoRender: { durationSeconds: 32 } });
    (jobService.uploadVideoForJob as any).mockResolvedValue({});

    await scheduler.runPipeline();
    expect(jobService.uploadVideoForJob).toHaveBeenCalledWith("job-456");
    expect(sendApproval.sendApprovalRequestForJob).not.toHaveBeenCalled();
  });
  it("processApprovedUploads uploads already approved jobs", async () => {
    const approvedJobs = [
      { id: "approved-1", status: "approved" },
      { id: "approved-2", status: "approved" },
    ];
    (jobRepository.listJobs as any).mockResolvedValue(approvedJobs);
    (jobService.uploadVideoForJob as any).mockResolvedValue({});

    await scheduler.processApprovedUploads();
    expect(jobRepository.listJobs).toHaveBeenCalledWith({ status: "approved" });
    expect(jobService.uploadVideoForJob).toHaveBeenCalledWith("approved-1");
    expect(jobService.uploadVideoForJob).toHaveBeenCalledWith("approved-2");
  });

  it("rejects invalid configuration values during updateConfig", async () => {
    const config: SchedulerConfig = {
      automationEnabled: false,
      intervalHours: 4,
      defaultStyle: "explainer",
      defaultDurationSeconds: 35,
      requireApproval: true,
      youtubeVisibility: "public",
      lastGenerationAt: null,
      nextGenerationAt: null,
      minDurationSeconds: 30,
      maxDurationSeconds: 45,
      languages: ["en"],
      enabledVoices: ["en_US-amy-medium"],
      contentCategories: ["science"],
      lastJobId: null,
      timezone: "UTC",
      defaultLanguage: "en",
      updatedAt: "",
    };
    mockConfigRepo.get.mockResolvedValue(config);

    // Invalid interval
    await expect(scheduler.updateConfig({ intervalHours: -5 })).rejects.toThrow("Interval hours must be a positive number.");
    
    // Invalid timezone
    await expect(scheduler.updateConfig({ timezone: "Invalid/Zone" })).rejects.toThrow("Invalid timezone: Invalid/Zone");

    // Invalid language
    await expect(scheduler.updateConfig({ languages: ["fr"] })).rejects.toThrow("Unsupported language: fr");

    // Invalid voice
    await expect(scheduler.updateConfig({ enabledVoices: ["invalid-voice"] })).rejects.toThrow("Invalid voice ID: invalid-voice");

    // Invalid category
    await expect(scheduler.updateConfig({ contentCategories: ["invalid-cat" as any] })).rejects.toThrow("Invalid content category: invalid-cat");
  });
});

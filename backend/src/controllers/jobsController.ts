import type { NextFunction, Request, Response } from "express";
import * as jobService from "../services/jobs/jobService.js";
import { sendApprovalRequestForJob } from "../services/telegram/sendApproval.js";
import { cacheAssetPath, readCachedAsset } from "../services/visual/assetCache.js";
import type { JobStatus } from "../types/index.js";

export async function createJobHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const job = await jobService.createJob(req.body);
    res.status(201).json(job);
  } catch (err) {
    next(err);
  }
}

export async function listJobsHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const status = typeof req.query.status === "string" ? (req.query.status as JobStatus) : undefined;
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const jobs = await jobService.listJobs({ status, search });
    res.json(jobs);
  } catch (err) {
    next(err);
  }
}

export async function getJobHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const job = await jobService.getJobOrThrow(req.params.id);
    res.json(job);
  } catch (err) {
    next(err);
  }
}

export async function cancelJobHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const job = await jobService.cancelJob(req.params.id);
    res.json(job);
  } catch (err) {
    next(err);
  }
}

export async function retryJobHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const job = await jobService.retryJob(req.params.id);
    res.json(job);
  } catch (err) {
    next(err);
  }
}

export async function generateScriptHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const job = await jobService.processQueuedJob(req.params.id);
    res.json(job);
  } catch (err) {
    next(err);
  }
}

export async function regenerateScriptHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const instruction = typeof req.body?.instruction === "string" ? req.body.instruction : undefined;
    const job = await jobService.regenerateScript(req.params.id, instruction);
    res.json(job);
  } catch (err) {
    next(err);
  }
}

export async function generateVoiceHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const job = await jobService.generateVoiceForJob(req.params.id);
    res.json(job);
  } catch (err) {
    next(err);
  }
}

export async function regenerateVoiceHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const job = await jobService.regenerateVoiceForJob(req.params.id);
    res.json(job);
  } catch (err) {
    next(err);
  }
}

export async function regenerateSceneVoiceHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const job = await jobService.regenerateVoiceForScene(req.params.id, req.params.sceneId);
    res.json(job);
  } catch (err) {
    next(err);
  }
}

export async function getSceneAudioHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // The file served is always the path the server itself generated and
    // stored on the job — sceneId only selects which of the job's own
    // scenes to look up, so a client can never point this at an arbitrary
    // filesystem path.
    const job = await jobService.getJobOrThrow(req.params.id);
    const scene = job.content?.scenes.find((candidate) => candidate.id === req.params.sceneId);
    if (!scene || scene.audio?.status !== "ready" || !scene.audio.path) {
      res.status(404).json({ error: "No audio is available for this scene." });
      return;
    }
    res.sendFile(scene.audio.path, (err) => {
      if (err) next(err);
    });
  } catch (err) {
    next(err);
  }
}

export async function regenerateSceneVisualHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const job = await jobService.regenerateVisualsForScene(req.params.id, req.params.sceneId);
    res.json(job);
  } catch (err) {
    next(err);
  }
}

export async function getVisualAssetHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Same pattern as getSceneAudioHandler: assetId only selects among the
    // assets this job's own scenes already reference — a client can never
    // point this at an arbitrary cache entry, let alone an arbitrary path.
    const job = await jobService.getJobOrThrow(req.params.id);
    const assetId = req.params.assetId;
    const owned = job.content?.scenes.some((scene) => scene.visual?.assets?.some((asset) => asset.id === assetId));
    if (!owned) {
      res.status(404).json({ error: "No visual asset is available with this id for this job." });
      return;
    }
    const meta = await readCachedAsset(assetId);
    if (!meta) {
      res.status(404).json({ error: "No visual asset is available with this id for this job." });
      return;
    }
    res.sendFile(cacheAssetPath(meta.id, meta.ext), (err) => {
      if (err) next(err);
    });
  } catch (err) {
    next(err);
  }
}

export async function renderVideoHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const job = await jobService.renderVideoForJob(req.params.id);
    res.json(job);
  } catch (err) {
    next(err);
  }
}

export async function qualityCheckHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const job = await jobService.runQualityCheckForJob(req.params.id);
    res.json(job);
  } catch (err) {
    next(err);
  }
}

export async function qualityReportHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const job = await jobService.getJobOrThrow(req.params.id);
    if (!job.qualityReport) {
      res.status(404).json({ error: "No quality report is available for this job yet." });
      return;
    }
    res.json(job.qualityReport);
  } catch (err) {
    next(err);
  }
}

export async function sendApprovalHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const job = await sendApprovalRequestForJob(req.params.id);
    res.json(job);
  } catch (err) {
    next(err);
  }
}

export async function getApprovalHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const job = await jobService.getJobOrThrow(req.params.id);
    if (!job.approval) {
      res.status(404).json({ error: "No approval has been requested for this job yet." });
      return;
    }
    res.json(job.approval);
  } catch (err) {
    next(err);
  }
}

export async function uploadYoutubeHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const job = await jobService.uploadVideoForJob(req.params.id);
    res.json(job);
  } catch (err) {
    next(err);
  }
}

export async function getJobVideoHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Same pattern as getSceneAudioHandler — the path served is always the
    // one the server itself recorded on the job, never anything supplied
    // by the client.
    const job = await jobService.getJobOrThrow(req.params.id);
    // Keyed on videoRender status alone, not job.status: once Phase 9's QC
    // engine moves a job past "video_ready" (to "quality_check"/"ready"/
    // "failed" on a QC-only failure) the rendered file is still the same
    // valid video and must stay playable.
    if (job.videoRender?.status !== "ready" || !job.videoRender.path) {
      res.status(404).json({ error: "No video is available for this job." });
      return;
    }
    res.sendFile(job.videoRender.path, (err) => {
      if (err) next(err);
    });
  } catch (err) {
    next(err);
  }
}

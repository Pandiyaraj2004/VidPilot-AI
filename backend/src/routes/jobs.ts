import { Router } from "express";
import {
  cancelJobHandler,
  createJobHandler,
  getJobHandler,
  getJobVideoHandler,
  getLatestJobHandler,
  getSceneAudioHandler,
  getVisualAssetHandler,
  listJobsHandler,
  qualityReportHandler,
  retryJobHandler,
} from "../controllers/jobsController.js";

export const jobsRouter = Router();

jobsRouter.post("/jobs", createJobHandler);
jobsRouter.get("/jobs", listJobsHandler);
jobsRouter.get("/jobs/latest", getLatestJobHandler);
jobsRouter.get("/jobs/:id", getJobHandler);
jobsRouter.patch("/jobs/:id/cancel", cancelJobHandler);
jobsRouter.patch("/jobs/:id/retry", retryJobHandler);
jobsRouter.get("/jobs/:id/scenes/:sceneId/audio", getSceneAudioHandler);
jobsRouter.get("/jobs/:id/visuals/:assetId", getVisualAssetHandler);
jobsRouter.get("/jobs/:id/video", getJobVideoHandler);
jobsRouter.get("/jobs/:id/quality-report", qualityReportHandler);

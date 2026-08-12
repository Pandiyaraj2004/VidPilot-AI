import { Router } from "express";
import {
  cancelJobHandler,
  createJobHandler,
  generateScriptHandler,
  generateVoiceHandler,
  getApprovalHandler,
  getJobHandler,
  getJobVideoHandler,
  getLatestJobHandler,
  getSceneAudioHandler,
  getVisualAssetHandler,
  listJobsHandler,
  qualityCheckHandler,
  qualityReportHandler,
  regenerateScriptHandler,
  regenerateSceneVisualHandler,
  regenerateSceneVoiceHandler,
  regenerateVoiceHandler,
  renderVideoHandler,
  retryJobHandler,
  sendApprovalHandler,
  uploadYoutubeHandler,
} from "../controllers/jobsController.js";

export const jobsRouter = Router();

jobsRouter.post("/jobs", createJobHandler);
jobsRouter.get("/jobs", listJobsHandler);
jobsRouter.get("/jobs/latest", getLatestJobHandler);
jobsRouter.get("/jobs/:id", getJobHandler);
jobsRouter.patch("/jobs/:id/cancel", cancelJobHandler);
jobsRouter.patch("/jobs/:id/retry", retryJobHandler);
jobsRouter.post("/jobs/:id/generate-script", generateScriptHandler);
jobsRouter.post("/jobs/:id/regenerate-script", regenerateScriptHandler);
jobsRouter.post("/jobs/:id/generate-voice", generateVoiceHandler);
jobsRouter.post("/jobs/:id/regenerate-voice", regenerateVoiceHandler);
jobsRouter.post("/jobs/:id/scenes/:sceneId/regenerate-voice", regenerateSceneVoiceHandler);
jobsRouter.get("/jobs/:id/scenes/:sceneId/audio", getSceneAudioHandler);
jobsRouter.post("/jobs/:id/scenes/:sceneId/regenerate-visual", regenerateSceneVisualHandler);
jobsRouter.get("/jobs/:id/visuals/:assetId", getVisualAssetHandler);
jobsRouter.post("/jobs/:id/render-video", renderVideoHandler);
jobsRouter.get("/jobs/:id/video", getJobVideoHandler);
jobsRouter.post("/jobs/:id/quality-check", qualityCheckHandler);
jobsRouter.get("/jobs/:id/quality-report", qualityReportHandler);
jobsRouter.post("/jobs/:id/telegram/send-approval", sendApprovalHandler);
jobsRouter.get("/jobs/:id/approval", getApprovalHandler);
jobsRouter.post("/jobs/:id/youtube/upload", uploadYoutubeHandler);

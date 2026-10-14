import { workspaceRouter } from "./workspace.js";
import { Router } from "express";
import { jobsRouter } from "./jobs.js";
import { statusRouter } from "./status.js";
import { voicesRouter } from "./voices.js";
import { youtubeRouter } from "./youtube.js";
import { automationRouter } from "./automation.js";

export const apiRouter = Router();

apiRouter.use(statusRouter);
apiRouter.use(jobsRouter);
apiRouter.use(voicesRouter);
apiRouter.use(youtubeRouter);
apiRouter.use(automationRouter);

apiRouter.use(workspaceRouter);

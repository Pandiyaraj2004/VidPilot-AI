import { Router } from "express";
import { jobsRouter } from "./jobs.js";
import { statusRouter } from "./status.js";
import { telegramRouter } from "./telegram.js";
import { voicesRouter } from "./voices.js";
import { youtubeRouter } from "./youtube.js";

export const apiRouter = Router();

apiRouter.use(statusRouter);
apiRouter.use(jobsRouter);
apiRouter.use(voicesRouter);
apiRouter.use(telegramRouter);
apiRouter.use(youtubeRouter);

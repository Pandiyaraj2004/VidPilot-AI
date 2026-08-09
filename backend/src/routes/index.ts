import { Router } from "express";
import { statusRouter } from "./status.js";

export const apiRouter = Router();

apiRouter.use(statusRouter);

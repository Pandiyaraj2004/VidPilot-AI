import { Router, type Request, type Response, type NextFunction } from "express";
import { getSchedulerService } from "../services/scheduler/index.js";
import { AutomationHistory } from "../services/scheduler/automationHistory.js";

export const automationRouter = Router();
const scheduler = getSchedulerService();
const history = new AutomationHistory();

async function getAutomationHandler(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const config = await scheduler.getConfig();
    const eventLog = await history.read();
    res.json({
      config,
      history: eventLog,
    });
  } catch (err) {
    next(err);
  }
}

async function updateAutomationHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const saved = await scheduler.updateConfig(req.body);
    res.json(saved);
  } catch (err) {
    next(err);
  }
}

async function runNowHandler(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Generate scheduled video immediately without altering next scheduled run
    void scheduler.runPipeline();
    res.json({ success: true, message: "Production pipeline triggered immediately." });
  } catch (err) {
    next(err);
  }
}

automationRouter.get("/automation", getAutomationHandler);
automationRouter.put("/automation", updateAutomationHandler);
automationRouter.post("/automation/run-now", runNowHandler);

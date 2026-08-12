import cors from "cors";
import express from "express";
import { config } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { apiRouter } from "./routes/index.js";
import { startTelegramPolling } from "./services/telegram/telegramPoller.js";
import { SchedulerService } from "./services/scheduler/index.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api", apiRouter);
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(config.port, async () => {
  // eslint-disable-next-line no-console
  console.log(`VidPilot backend listening on port ${config.port}`);
  startTelegramPolling();
  
  // Start the scheduler config setup & loops
  try {
    const scheduler = new SchedulerService();
    const config = await scheduler.getConfig();
    if (config.automationEnabled) {
      scheduler.startLoop();
    }
  } catch (err) {
    console.error("[Scheduler Startup] Failed to boot scheduler:", err);
  }
});

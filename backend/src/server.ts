import cors from "cors";
import express from "express";
import { config } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { apiRouter } from "./routes/index.js";
import { startTelegramPolling } from "./services/telegram/telegramPoller.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api", apiRouter);
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`VidPilot backend listening on port ${config.port}`);
  startTelegramPolling();
});

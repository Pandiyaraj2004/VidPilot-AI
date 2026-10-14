import cors from "cors";
import express from "express";
import path from "node:path";
import { config } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { authenticate, login, localSession } from "./middleware/auth.js";
import { apiRouter } from "./routes/index.js";
import { getSchedulerService } from "./services/scheduler/index.js";
import { runCleanup } from "./services/maintenance/cleanup.js";
if (config.nodeEnv === "production" && ((process.env.ADMIN_PASSWORD?.length ?? 0) < 16 || (process.env.SESSION_SECRET?.length ?? 0) < 32))
    throw new Error("Production requires ADMIN_PASSWORD (16+ characters) and SESSION_SECRET (32+ characters)");
export const app = express();
export const readiness = { ready: config.nodeEnv === "test", error: null };
app.disable("x-powered-by");
app.use(cors({ origin: (origin, callback) => {
        let local = false;
        try {
            const url = new URL(origin ?? "");
            local = url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
        }
        catch { /* Non-browser requests need no CORS header. */ }
        callback(null, origin === config.youtube.frontendUrl || local);
    }, allowedHeaders: ["Content-Type", "Authorization"] }));
app.use(express.json({ limit: "100kb" }));
app.get("/health/live", (_req, res) => res.json({ ok: true }));
app.get("/health", (_req, res) => res.status(readiness.ready ? 200 : 503).json({ ok: readiness.ready, error: readiness.error }));
app.post("/api/session", login);
app.post("/api/session/local", localSession);
app.use("/api", authenticate, apiRouter);
if (process.env.SERVE_DASHBOARD === "true")
    app.use(express.static(path.resolve(process.cwd(), "../frontend/dist")));
app.use(notFoundHandler);
app.use(errorHandler);
if (process.env.NODE_ENV !== "test" && process.env.MAINTENANCE_MODE !== "true" && process.env.SERVER_BOOTSTRAP !== "manual")
    app.listen(config.port, async () => {
        console.info(`vidpilot ai listening on ${config.port}`);
        try {
            const cleanup = await runCleanup();
            if (cleanup.errors?.length)
                throw new Error(`Startup cleanup failed: ${cleanup.errors.join("; ")}`);
            readiness.ready = true;
            if (process.env.WORKER_ENABLED !== "false")
                getSchedulerService().startLoop();
        }
        catch (e) {
            readiness.error = e.message;
            console.error("Startup blocked:", e);
        }
    });

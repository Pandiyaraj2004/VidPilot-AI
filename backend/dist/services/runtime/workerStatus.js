import { runtimeState } from "./state.js";
export async function recordWorker(state, error = null) {
    await runtimeState.set("worker:status", { state, updatedAt: new Date().toISOString(), error });
}
export async function readWorker() {
    const record = await runtimeState.get("worker:status");
    return record ? { ...record, online: Date.now() - Date.parse(record.updatedAt) < 120000 } : { state: "idle", updatedAt: "", error: null, online: false };
}

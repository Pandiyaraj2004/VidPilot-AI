import { runtimeState } from "../runtime/state.js";
export class SchedulerLock {
    state;
    constructor(state = runtimeState) {
        this.state = state;
    }
    acquire(key) { return this.state.claim(`lock:${key}`, { createdAt: new Date().toISOString() }); }
    release(key) { return this.state.remove(`lock:${key}`); }
}

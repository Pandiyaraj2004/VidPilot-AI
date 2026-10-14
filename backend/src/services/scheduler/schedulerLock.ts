import { runtimeState, type RuntimeState } from "../runtime/state.js";
export class SchedulerLock {
 constructor(private state: RuntimeState = runtimeState) {}
 acquire(key:string):Promise<boolean> { return this.state.claim(`lock:${key}`,{createdAt:new Date().toISOString()}); }
 release(key:string):Promise<void> { return this.state.remove(`lock:${key}`); }
}

import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";import path from "node:path";
import {afterEach,beforeEach,expect,it} from "vitest";
import {RuntimeState} from "./state.js";import {SchedulerLock} from "../scheduler/schedulerLock.js";
let dir:string;beforeEach(async()=>{dir=await mkdtemp(path.join(tmpdir(),"vp-state-"));});afterEach(async()=>{await rm(dir,{recursive:true,force:true});});
it("only one concurrent durable claim succeeds",async()=>{const a=new RuntimeState(dir),b=new RuntimeState(dir);expect((await Promise.all([a.claim("publish",{id:1}),b.claim("publish",{id:2})])).filter(Boolean)).toHaveLength(1);expect(await new RuntimeState(dir).get("publish")).not.toBeNull();});
it("releases genuine contention",async()=>{const lock=new SchedulerLock(new RuntimeState(dir));expect(await lock.acquire("slot")).toBe(true);expect(await lock.acquire("slot")).toBe(false);await lock.release("slot");expect(await lock.acquire("slot")).toBe(true);});
it("does not convert filesystem errors into contention",async()=>{const lock=new SchedulerLock(new RuntimeState(path.join(dir,"bad\0path")));await expect(lock.acquire("slot")).rejects.toThrow();});

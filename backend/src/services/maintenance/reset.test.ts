import {expect,it} from "vitest";import {executeReset,type ResetManifest} from "./reset.js";
import {verifiedOrphan} from "./reset.js";
import {mkdtemp,mkdir,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";import path from "node:path";
it("requires explicit confirmation before any reset IO",async()=>{await expect(executeReset({} as ResetManifest,"")).rejects.toThrow("confirmation");});
it("rejects a manifest from another project root before deletion",async()=>{await expect(executeReset({version:1,root:"/unrelated"} as ResetManifest,"DELETE_OLD_VIDPILOT_DATA")).rejects.toThrow("root mismatch");});
it("blocks a partial inventory before acquiring locks or deleting anything",async()=>{await expect(executeReset({version:1,root:process.cwd(),incomplete:true} as ResetManifest,"DELETE_OLD_VIDPILOT_DATA")).rejects.toThrow("Incomplete inventory");});
it("recognizes generated orphan media and rejects unrelated files",async()=>{const dir=await mkdtemp(path.join(tmpdir(),"vp-reset-"));try{await mkdir(path.join(dir,"render"));await writeFile(path.join(dir,"render","scene-001.mp4"),"fixture");expect(await verifiedOrphan(dir)).toBe(true);await writeFile(path.join(dir,"personal.txt"),"keep");expect(await verifiedOrphan(dir)).toBe(false);}finally{await rm(dir,{recursive:true,force:true});}});

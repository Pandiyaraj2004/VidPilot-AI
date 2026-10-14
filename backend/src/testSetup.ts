import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";import path from "node:path";
import {afterAll} from "vitest";
const root=mkdtempSync(path.join(tmpdir(),"vidpilot-tests-"));
process.env.STATE_DIR=path.join(root,"state");process.env.JOB_DATA_DIR=path.join(root,"data");process.env.SCHEDULER_DATA_DIR=path.join(root,"scheduler");
process.env.YOUTUBE_TOKEN_STORE_PATH=path.join(root,"youtube.json");
process.env.VOICE_STORAGE_DIR=path.join(root,"jobs");process.env.VIDEO_STORAGE_DIR=path.join(root,"jobs");process.env.VISUAL_ASSET_CACHE_DIR=path.join(root,"visual-cache");process.env.JAMENDO_CACHE_DIR=path.join(root,"music-cache");
const fetchLocal=globalThis.fetch;
globalThis.fetch=(input,init)=>{
 const url=new URL(typeof input==="string"?input:input instanceof URL?input.href:input.url);
 if(!["127.0.0.1","localhost","[::1]"].includes(url.hostname))return Promise.reject(new Error("External network disabled in unit tests; mock this provider"));
 return fetchLocal(input,init);
};
afterAll(()=>rmSync(root,{recursive:true,force:true}));

import dotenv from 'dotenv';import assert from 'node:assert/strict';import {writeFile} from 'node:fs/promises';
dotenv.config({quiet:true});
Object.assign(process.env,{NODE_ENV:'test',WORKER_ENABLED:'false',PORT:'4013'});
const {app}=await import('../dist/server.js');
const {readToken,writeToken}=await import('../dist/services/youtube/tokenStore.js');
const server=await new Promise(resolve=>{const s=app.listen(4013,'127.0.0.1',()=>resolve(s));});
const base='http://127.0.0.1:4013/api';
try{
 const denied=await fetch(base+'/workspace');assert.equal(denied.status,401);
 const login=await fetch(base+'/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:process.env.ADMIN_PASSWORD})});assert.equal(login.status,200);const {token}=await login.json();
 const headers={Authorization:`Bearer ${token}`};
 const before=await fetch(base+'/workspace',{headers});assert.equal(before.status,200);const workspace=await before.json();
 const old=await readToken();if(old){await writeToken(old);const durable=await readToken();assert.equal(durable.refreshToken,old.refreshToken);}
 const youtube=await fetch(base+'/youtube/status',{headers});const youtubeStatus=await youtube.json();
 const report={at:new Date().toISOString(),auth:true,workspace:true,jobCount:workspace.jobs.length,storage:workspace.storage,productionCleanupExecuted:false,cleanupValidation:"isolated automated tests only",oauthMigrated:Boolean(old),youtube:{httpStatus:youtube.status,connected:youtubeStatus.connected,error:youtubeStatus.error??null},uploaded:false};
 await writeFile('../maintenance/production-smoke.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await new Promise(resolve=>server.close(resolve));}

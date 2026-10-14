// Reconcile ONLY the known test upload rejected by OAuth before acceptance.
import dotenv from 'dotenv';import path from 'node:path';dotenv.config({quiet:true});
process.env.FORCE_LOCAL_STORAGE='false';
const {LocalJobRepository}=await import('../dist/services/jobs/localJobRepository.js');
const {runtimeState}=await import('../dist/services/runtime/state.js');
const {readToken,writeToken}=await import('../dist/services/youtube/tokenStore.js');
const id='28bf7c35-44ea-45e1-ad40-3d5913d8961b',repo=new LocalJobRepository(path.resolve('../maintenance/e2e/data'));
const job=await repo.getJob(id),record=await runtimeState.get(`publication:${id}`);
if(!job?.youtube?.lastError?.includes('expired or was revoked')||record?.status!=='intent'||record.videoId)throw new Error('Not the verified OAuth-rejected test intent; reconciliation refused');
await runtimeState.set(`publication-rejection:${id}`,{reason:'invalid_grant',at:new Date().toISOString(),intentAt:record.createdAt});
await runtimeState.remove(`publication:${id}`);
await repo.updateJob(id,{youtube:{...job.youtube,status:'failed'},lastError:'YouTube rejected authentication before accepting the video. Reconnect YouTube in Settings.'});
const token=await readToken();if(token)await writeToken({...token,connectionError:'Your YouTube connection has expired or was revoked. Reconnect YouTube in Settings.'});
console.log('Known OAuth-rejected test reconciled. No successful upload identifier existed or was deleted.');

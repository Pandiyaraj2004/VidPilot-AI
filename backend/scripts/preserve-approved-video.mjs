// Keep only the approved final output temporarily in managed cloud storage
// while the user reconnects YouTube. Delete it automatically after publishing.
import dotenv from 'dotenv';import path from 'node:path';import {writeFile} from 'node:fs/promises';dotenv.config({quiet:true});
process.env.FORCE_LOCAL_STORAGE='false';
const {LocalJobRepository}=await import('../dist/services/jobs/localJobRepository.js');
const {getSupabaseClient}=await import('../dist/services/supabase/index.js');
const {storageManager}=await import('../dist/services/storage/storageManager.js');
const {getMediaUrl}=await import('../dist/services/supabase/storage.js');
const repo=new LocalJobRepository(path.resolve('../maintenance/e2e/data'));
const job=await repo.getJob('28bf7c35-44ea-45e1-ad40-3d5913d8961b');
if(job?.qualityReport?.status!=='PASS'||job.youtubeVideoId)throw new Error('Only the approved, unpublished QC-passed test may be preserved');
const name=await storageManager.upload('rendered-videos',job.videoRender.path,`${job.id}/final.mp4`);
const url=await getMediaUrl('rendered-videos',name);
const queued={...job,status:'qc_passed',attempts:0,nextAttemptAt:null,videoRender:{...job.videoRender,path:url},youtube:{...job.youtube,status:'failed'},lastError:'Reconnect YouTube once to resume automatic publishing.'};
const client=getSupabaseClient();const {data:exists,error:readError}=await client.from('jobs').select('id').eq('id',job.id).maybeSingle();if(readError)throw readError;
if(exists)throw new Error('Existing job refused; review before overwriting');
const {error}=await client.from('jobs').insert({id:job.id,topic:job.topic,status:queued.status,created_at:job.createdAt,updated_at:new Date().toISOString(),data:queued});if(error)throw error;
await writeFile('../maintenance/approved-video-cloud.json',JSON.stringify({jobId:job.id,object:name,bytes:job.videoRender.fileSizeBytes,expiresAfterDays:7,deleteAfterPublication:true},null,2));console.log('Approved final video preserved temporarily; original intermediates are now eligible for local removal.');

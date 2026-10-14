// Real providers and native rendering, isolated records, and NO publishing call.
import dotenv from 'dotenv';
import path from 'node:path';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
dotenv.config({quiet:true});
const root=path.resolve('../maintenance/e2e');
await mkdir(root,{recursive:true});
Object.assign(process.env,{NODE_ENV:'test',FORCE_LOCAL_STORAGE:'true',WORKER_ENABLED:'false',PORT:'4012',STATE_DIR:path.join(root,'state'),JOB_DATA_DIR:path.join(root,'data'),SCHEDULER_DATA_DIR:path.join(root,'scheduler'),VOICE_STORAGE_DIR:path.join(root,'jobs'),VIDEO_STORAGE_DIR:path.join(root,'jobs'),VISUAL_ASSET_CACHE_DIR:path.join(root,'visual-cache'),JAMENDO_CACHE_DIR:path.join(root,'music-cache'),ADMIN_PASSWORD:randomBytes(24).toString('hex'),SESSION_SECRET:randomBytes(32).toString('hex'),FRONTEND_URL:'http://localhost:5173'});
const jobs=await import('../dist/services/jobs/jobService.js');
const {app}=await import('../dist/server.js');
const {generateVideoContent}=await import('../dist/services/ai/contentEngine.js');
const {GeminiProvider}=await import('../dist/services/ai/geminiProvider.js');
const {jobRepository}=await import('../dist/services/jobs/index.js');
const {renderJobVideo}=await import('../dist/services/video/renderEngine.js');
const {getSceneRenderPath,getFinalVideoPath}=await import('../dist/services/video/videoStorage.js');
const {validateVideoFile}=await import('../dist/services/video/videoValidator.js');
const {concatScenesWithTransitions}=await import('../dist/services/video/sceneTransitionConcat.js');
const {planSceneTransition}=await import('../dist/services/video/sceneTransitionPlanner.js');
const {createJobOrchestrator}=jobs;
async function resumeIsolatedRender(options){
 const paths=[],durations=[],transitions=[],recent=[];
 for(const scene of [...options.scenes].sort((a,b)=>a.order-b.order)){
  const file=getSceneRenderPath(options.jobId,scene.order);
  let valid=false;try{valid=(await validateVideoFile(file,scene.audio.duration)).valid;}catch{/* Missing/incomplete scenes are rendered. */}
  if(!valid){console.log('Rendering remaining real scene:',scene.id);await renderJobVideo({...options,scenes:[scene]});}
  else console.log('Reusing validated isolated-test scene:',scene.id);
  if(paths.length){const plan=planSceneTransition(options.contentCategory,scene.visual?.emotion??scene.emotion,scene.energy,transitions.length,durations.at(-1),scene.audio.duration,recent);transitions.push(plan);recent.push(plan.type);}
  paths.push(file);durations.push(scene.audio.duration);
 }
 const finalVideoPath=getFinalVideoPath(options.jobId);
 const {finalDurationSeconds}=await concatScenesWithTransitions(paths,durations,transitions,finalVideoPath);
 return {finalVideoPath,totalDurationSeconds:finalDurationSeconds};
}
// This test specifically verifies Gemini; it does not silently switch providers.
const service=createJobOrchestrator(jobRepository,ctx=>generateVideoContent(ctx,[new GeminiProvider()]),undefined,undefined,undefined,resumeIsolatedRender);
const server=await new Promise(resolve=>{const s=app.listen(4012,'127.0.0.1',()=>resolve(s));});
let job;
const result={startedAt:new Date().toISOString(),visibility:'unlisted',uploaded:false,stages:[]};
try {
 try {const saved=JSON.parse(await readFile(path.join(root,'result.json'),'utf8'));if(saved.jobId)job=await service.getJobOrThrow(saved.jobId);}catch(e){if(e.code!=='ENOENT')throw e;}
 job??=await service.createJob({topic:'Why does the Moon seem to change shape? Explain reflected sunlight and its orbit around Earth using clear everyday English and accurate facts.',style:'explainer',contentCategory:'space',durationSeconds:30,language:'en',voiceId:'en_US-amy-medium',voiceSpeed:1,visualStyle:'cinematic',subtitlesEnabled:true,youtubeVisibility:'unlisted'});
 result.jobId=job.id;
 if(job.status==='rendering')job=await jobRepository.updateJob(job.id,{status:'voice_ready',lastError:null});
 const save=async()=>writeFile(path.join(root,'result.json'),JSON.stringify({...result,status:job.status,provider:job.scriptProvider,model:job.scriptModel,videoPath:job.videoRender?.path,qc:job.qualityReport,error:job.lastError},null,2));
 await save();
 for(const [name,fn,needed] of [['script',service.processQueuedJob,!job.content],['narration',service.generateVoiceForJob,job.voiceGeneration?.status!=='ready'],['render',service.renderVideoForJob,job.videoRender?.status!=='ready'],['quality',service.runQualityCheckForJob,true]]) {
  if(!needed)continue;
  console.log('Real E2E stage:',name);if(name==='script'&&job.status==='failed')job=await service.retryJob(job.id);job=await fn(job.id);result.stages.push({name,status:job.status,at:new Date().toISOString()});await save();if(job.status==='failed')throw new Error(job.lastError??`${name} failed`);
 }
 console.log(JSON.stringify({jobId:job.id,status:job.status,provider:job.scriptProvider,videoPath:job.videoRender?.path,qc:job.qualityReport?.status,uploaded:false},null,2));
}catch(e){result.error=e.message;result.finishedAt=new Date().toISOString();if(job){job=await service.getJobOrThrow(job.id);result.jobId=job.id;result.job=job;}await writeFile(path.join(root,'failure.json'),JSON.stringify(result,null,2));console.error('Real E2E stopped:',e.message);process.exitCode=1;}
finally{await new Promise(resolve=>server.close(resolve));}

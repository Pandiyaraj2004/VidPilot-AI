// Personal dashboard and OAuth callback server. Starts the configured worker
// after checking the durable YouTube connection.
import dotenv from 'dotenv';dotenv.config({quiet:true});
import {createWriteStream,mkdirSync} from 'node:fs';
mkdirSync(new URL('../../maintenance/',import.meta.url),{recursive:true});
const workerLog=createWriteStream(new URL('../../maintenance/worker-runtime.log',import.meta.url),{flags:'a'});
process.stdout.write=workerLog.write.bind(workerLog);
process.stderr.write=workerLog.write.bind(workerLog);
Object.assign(process.env,{NODE_ENV:'production',SERVER_BOOTSTRAP:'manual'});
const {app,readiness}=await import('../dist/server.js');
const port=Number(process.env.PORT??4000);
app.listen(port,'127.0.0.1',async()=>{console.log(`Personal dashboard API available at http://localhost:${port}`);try{const {youtubeProvider}=await import('../dist/services/youtube/index.js');const connected=await youtubeProvider.isConnected();readiness.ready=true;if(process.env.WORKER_ENABLED==='true'&&connected){const {getSchedulerService}=await import('../dist/services/scheduler/index.js');getSchedulerService().startLoop();}else console.log('Reconnect YouTube once in Settings; the automatic worker starts after authorization.');}catch(e){readiness.error=e.message;console.error('Worker startup failed:',e.message);process.exit(1);}});

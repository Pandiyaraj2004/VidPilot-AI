import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd();const lock=JSON.parse(await readFile('package-lock.json','utf8'));
async function size(dir,filter=()=>true){let bytes=0;try{for(const e of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(!filter(p)||e.isSymbolicLink())continue;bytes+=e.isDirectory()?await size(p,filter):(await stat(p)).size;}}catch(e){if(e.code!=='ENOENT')throw e;}return bytes;}
const devRoots=Object.entries(lock.packages).filter(([p,v])=>p&&v.dev).map(([p])=>path.join(root,p)+path.sep);
const productionDependencies=await size(path.join(root,'node_modules'),p=>!devRoots.some(d=>(p+path.sep).startsWith(d))&&!p.includes(`${path.sep}.cache${path.sep}`));
const nativeRequired=await size(path.join(root,'vendor'),p=>!/(?:ffplay\.exe|\.html|\.md|\.txt)$/i.test(p));
const application=(await Promise.all(['dist','remotion','assets'].map(d=>size(path.join(root,d),p=>!p.endsWith('.map')&&!p.endsWith('.test.ts'))))).reduce((a,b)=>a+b,0);
const chromePath=process.env.CHROMIUM_DIRECTORY??(process.platform==='win32'?'C:/Program Files/Google/Chrome/Application':'/usr/lib/chromium');
const browser=await size(chromePath);
const result={unit:'bytes',productionDependencies,application,nativeRequired,browser,browserPath:chromePath,completeMeasuredTotal:productionDependencies+application+nativeRequired+browser,limit:500000000,platform:process.platform,notes:'Measured installed production dependency tree; excludes generated media, tests, ffplay and binary documentation. Linux must be measured on Linux; this is not a compressed archive size.'};
console.log(JSON.stringify(result,null,2));await writeFile('../maintenance/deployment-size.json',JSON.stringify(result,null,2));

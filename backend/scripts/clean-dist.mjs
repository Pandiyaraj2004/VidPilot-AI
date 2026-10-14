import { lstat, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const backend=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const target=path.join(backend,'dist');
if(path.dirname(target)!==backend)throw new Error('Invalid build output root');
async function verify(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if((await lstat(file)).isSymbolicLink())throw new Error('Refusing symlink in build output');if(entry.isDirectory())await verify(file);}}
try{if((await lstat(target)).isSymbolicLink())throw new Error('Refusing linked dist');await verify(target);await rm(target,{recursive:true});}catch(e){if(e.code!=='ENOENT')throw e;}

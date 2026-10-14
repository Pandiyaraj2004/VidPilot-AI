import path from "node:path";
import { lstat, readdir, rm } from "node:fs/promises";
export async function removeOwnedDirectory(root: string, id: string): Promise<number> {
 if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error("Invalid owned workspace identifier");
 const base=path.resolve(root), target=path.resolve(base,id);
 if(!target.startsWith(base+path.sep)) throw new Error("Workspace escaped root");
 let bytes=0;
 async function verify(dir:string):Promise<void> {
  const info=await lstat(dir); if(info.isSymbolicLink()) throw new Error("Refusing symlink cleanup");
  if(info.isDirectory()) for(const item of await readdir(dir)) await verify(path.join(dir,item));
  else if(info.isFile()) bytes+=info.size;
 }
 try {if((await lstat(base)).isSymbolicLink())throw new Error("Refusing symlink root"); await verify(target);} catch(e) {if((e as NodeJS.ErrnoException).code === "ENOENT") return 0; throw e;}
 await rm(target,{recursive:true,force:true});
 return bytes;
}

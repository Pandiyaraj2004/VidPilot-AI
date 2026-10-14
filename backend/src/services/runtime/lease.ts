import { randomUUID } from "node:crypto";
import { runtimeState } from "./state.js";
import { isSupabaseConfigured, getSupabaseClient } from "../supabase/index.js";
export class Lease {
 private owner=randomUUID();
 constructor(private key:string) {}
 async acquire():Promise<boolean> {
  if(isSupabaseConfigured()) {
   const {data,error}=await getSupabaseClient().rpc("vidpilot_lease",{p_key:`lease:${this.key}`,p_owner:this.owner,p_seconds:120});
   if(error) throw new Error(`Lease database failure: ${error.message}`); return data === true;
  }
  const key=`lease:${this.key}`;
  const old=await runtimeState.get<{pid:number}>(key);
  if(old) {try {process.kill(old.pid,0);return false;} catch(e) {if((e as NodeJS.ErrnoException).code!=="ESRCH") throw e; await runtimeState.remove(key);}}
  return runtimeState.claim(key,{pid:process.pid,owner:this.owner});
 }
 async release():Promise<void> {
  const key=`lease:${this.key}`;
  if(isSupabaseConfigured()) {const {error}=await getSupabaseClient().rpc("vidpilot_release_lease",{p_key:key,p_owner:this.owner});if(error)throw new Error(`Lease release failed: ${error.message}`);return;}
  const old=await runtimeState.get<{owner:string}>(key);
  if(old?.owner===this.owner) await runtimeState.remove(key);
 }
 async assertHeld():Promise<void> {
  if(isSupabaseConfigured()) {if(!await this.acquire())throw new Error(`Lease lost: ${this.key}; maintenance stopped`);return;}
  const current=await runtimeState.get<{owner:string}>(`lease:${this.key}`);
  if(current?.owner!==this.owner)throw new Error(`Lease lost: ${this.key}; maintenance stopped`);
 }
}

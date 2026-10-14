import { runtimeState } from "./state.js";
export interface WorkerStatus {state:"idle"|"processing"|"error";updatedAt:string;error:string|null;}
export async function recordWorker(state:WorkerStatus["state"],error:string|null=null):Promise<void>{
 await runtimeState.set("worker:status",{state,updatedAt:new Date().toISOString(),error});
}
export async function readWorker():Promise<WorkerStatus & {online:boolean}>{
 const record=await runtimeState.get<WorkerStatus>("worker:status");
 return record?{...record,online:Date.now()-Date.parse(record.updatedAt)<120000}:{state:"idle",updatedAt:"",error:null,online:false};
}

// Explicit live integration test. Only unique test reservations/state are changed.
import dotenv from 'dotenv';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {writeFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
dotenv.config({quiet:true});
const client=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const prefix=`vp1/integration-${randomUUID()}`;const stateKey=`integration:${randomUUID()}`;
const results=[];
const usage=async()=>{const r=await client.rpc('vidpilot_storage_usage');assert.equal(r.error,null);return r.data;};
const before=await usage();
try{
 const incoming=100000000,available=500000000-before.usedBytes-before.reservedBytes;
 const attempts=await Promise.all(Array.from({length:4},(_,i)=>client.rpc('vidpilot_reserve',{p_bucket:'rendered-videos',p_name:`${prefix}/${i}`,p_bytes:incoming})));
 const accepted=attempts.filter(r=>!r.error&&r.data==='reserved_new').length;
 assert.equal(accepted,Math.min(4,Math.floor(available/incoming)));results.push({test:'concurrent capacity reservations',passed:true,accepted,rejected:4-accepted});
 const current=await usage();assert(current.usedBytes+current.reservedBytes<=500000000);
 const warningSize=Math.max(0,450000000-current.usedBytes-current.reservedBytes);
 const warning=await client.rpc('vidpilot_reserve',{p_bucket:'rendered-videos',p_name:`${prefix}/warning`,p_bytes:warningSize});assert.equal(warning.error,null);
 const warned=await usage();assert(warned.usedBytes+warned.reservedBytes>=450000000);results.push({test:'450 MB warning accounting',passed:true});
 const claims=await Promise.all([client.from('vidpilot_state').insert({key:stateKey,value:{test:true}}),client.from('vidpilot_state').insert({key:stateKey,value:{test:true}})]);
 assert.equal(claims.filter(r=>!r.error).length,1);assert.equal(claims.filter(r=>r.error?.code==='23505').length,1);results.push({test:'durable concurrent publication claim',passed:true});
}finally{
 const cleanup=await client.from('vidpilot_reservations').delete().eq('bucket','rendered-videos').like('name',`${prefix}/%`);assert.equal(cleanup.error,null);
 const state=await client.from('vidpilot_state').delete().eq('key',stateKey);assert.equal(state.error,null);
}
const after=await usage();assert.deepEqual(after,before);
const report={at:new Date().toISOString(),results,before,after,historicalDataDeleted:false,mediaUploaded:false};
await writeFile('../maintenance/supabase-integration.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));

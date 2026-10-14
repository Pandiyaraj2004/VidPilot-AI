import {describe,expect,it,vi,beforeEach} from "vitest";
import {capacity,expired,RETENTION_MS,StorageManager,STORAGE_LIMIT} from "./storageManager.js";
const mocks=vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock("../supabase/index.js",()=>({isSupabaseConfigured:()=>true,getSupabaseClient:()=>({rpc:mocks.rpc})}));
describe("storage accounting",()=>{
 beforeEach(()=>mocks.rpc.mockReset());
 it("permits exactly 500 decimal MB but never one byte more",()=>{expect(capacity(450000000,40000000,10000000)).toBe(true);expect(capacity(450000000,40000000,10000001)).toBe(false);});
 it("includes concurrent reservations",()=>{expect(capacity(400000000,90000000,20000000)).toBe(false);});
 it("rejects invalid accounting inputs",()=>{for(const n of [-1,NaN,Infinity,1.2])expect(capacity(n,0,1)).toBe(false);});
 it("expires exactly seven days after creation",()=>{const date="2026-01-01T00:00:00Z";expect(expired(date,Date.parse(date)+RETENTION_MS-1)).toBe(false);expect(expired(date,Date.parse(date)+RETENTION_MS)).toBe(true);expect(expired("invalid")).toBe(false);});
 it("uses actual storage and reservations returned by the database",async()=>{mocks.rpc.mockResolvedValue({data:{usedBytes:449000000,reservedBytes:2000000},error:null});expect(await new StorageManager().usage()).toMatchObject({warning:true,limitBytes:STORAGE_LIMIT,usedBytes:449000000});});
 it("fails closed when accounting is unavailable",async()=>{mocks.rpc.mockResolvedValue({error:{message:"offline"}});await expect(new StorageManager().usage()).rejects.toThrow("uploads blocked");});
});

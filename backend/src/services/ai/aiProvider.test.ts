import {createServer,type Server} from "node:http";
import {afterAll,beforeAll,expect,it} from "vitest";
import {fetchWithTimeout} from "./aiProvider.js";
let server:Server;let base:string;let headersSent=false;
beforeAll(async()=>{
 server=createServer((req,res)=>{res.writeHead(200,{"Content-Type":"application/json"});res.flushHeaders();if(req.url==="/slow"){headersSent=true;return;}res.end('{"ok":true}');});
 await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));const address=server.address();base=`http://127.0.0.1:${typeof address==="object"&&address?address.port:0}`;
});
afterAll(async()=>{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));});
it("keeps the AI deadline active after headers while the response body stalls",async()=>{
 await expect(fetchWithTimeout(base+"/slow",{},150,"gemini")).rejects.toMatchObject({kind:"timeout"});expect(headersSent).toBe(true);
});
it("preserves a complete structured response and its headers",async()=>{
 const response=await fetchWithTimeout(base+"/ok",{},1000,"gemini");expect(await response.json()).toEqual({ok:true});expect(response.headers.get("content-type")).toBe("application/json");
});

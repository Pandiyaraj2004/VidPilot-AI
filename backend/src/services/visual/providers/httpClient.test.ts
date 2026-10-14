import {expect,it,vi} from "vitest";import {withMediaRetry} from "./httpClient.js";
it("recovers from quota and transient provider errors with bounded backoff",async()=>{const fn=vi.fn().mockRejectedValueOnce(new Error("HTTP 429")).mockResolvedValue("ok"),sleep=vi.fn().mockResolvedValue(undefined);expect(await withMediaRetry(fn,sleep)).toBe("ok");expect(sleep).toHaveBeenCalledWith(250);});
it("stops after three failed attempts",async()=>{const fn=vi.fn().mockRejectedValue(new Error("HTTP 503"));await expect(withMediaRetry(fn,async()=>{})).rejects.toThrow("503");expect(fn).toHaveBeenCalledTimes(3);});
it("does not retry invalid credentials",async()=>{const fn=vi.fn().mockRejectedValue(new Error("HTTP 403"));await expect(withMediaRetry(fn,async()=>{})).rejects.toThrow("403");expect(fn).toHaveBeenCalledTimes(1);});
import {downloadToFile} from "./httpClient.js";
it("cools down a failed CDN so later scenes do not repeatedly spend the retry budget",async()=>{
 const previous=globalThis.fetch;const fetchMock=vi.fn(async()=>new Response("temporarily unavailable",{status:503}));globalThis.fetch=fetchMock;
 try{
  await expect(downloadToFile("https://failed-cdn.example.test/one.mp4","unused-download.mp4",1000)).rejects.toThrow("503");
  expect(fetchMock).toHaveBeenCalledTimes(3);
  await expect(downloadToFile("https://failed-cdn.example.test/two.mp4","unused-download.mp4",1000)).rejects.toThrow("cooling down");
  expect(fetchMock).toHaveBeenCalledTimes(3);
 }finally{globalThis.fetch=previous;}
});

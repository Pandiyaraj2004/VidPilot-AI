import {beforeEach,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({metadata:vi.fn(),file:vi.fn(),close:vi.fn(),validate:vi.fn()}));
vi.mock("msedge-tts",()=>({MsEdgeTTS:class{setMetadata=mocks.metadata;toFile=mocks.file;close=mocks.close;},OUTPUT_FORMAT:{AUDIO_24KHZ_96KBITRATE_MONO_MP3:"mp3"}}));
vi.mock("./audioTranscode.js",()=>({transcodeToWav:vi.fn()}));
vi.mock("./audioValidator.js",()=>({validateAudioFile:mocks.validate}));
import {EdgeTtsProvider} from "./edgeTtsProvider.js";
beforeEach(()=>{vi.clearAllMocks();mocks.metadata.mockResolvedValue(undefined);mocks.file.mockResolvedValue({audioFilePath:"fixture.mp3"});mocks.validate.mockResolvedValue({valid:true,metadata:{durationSeconds:3,sampleRate:24000}});});
it("sends Tamil text safely as SSML at natural speed and closes the connection",async()=>{
 const result=await new EdgeTtsProvider().generateSpeech({text:"இது A & B. அடுத்து <பதில்>!",language:"ta",voiceId:"ta-IN-PallaviNeural",speed:1,outputPath:"fixture.wav"});
 expect(mocks.file).toHaveBeenCalledWith(expect.any(String),"இது A &amp; B. அடுத்து &lt;பதில்&gt;!",{rate:1});
 expect(mocks.validate).toHaveBeenCalledWith("fixture.wav",{maxInternalSilenceSeconds:1.5});expect(result.durationSeconds).toBe(3);expect(mocks.close).toHaveBeenCalledOnce();
});
it("keeps the tight silence limit for one sentence",async()=>{
 await new EdgeTtsProvider().generateSpeech({text:"One sentence.",language:"en",voiceId:"en-US-AriaNeural",speed:1,outputPath:"fixture.wav"});
 expect(mocks.validate).toHaveBeenCalledWith("fixture.wav",{maxInternalSilenceSeconds:1});
});
it("reports a rejected voice service and closes without producing successful audio",async()=>{
 mocks.metadata.mockRejectedValue(new Error("Unexpected server response: 403"));
 await expect(new EdgeTtsProvider().generateSpeech({text:"வணக்கம்.",language:"ta",voiceId:"ta-IN-PallaviNeural",speed:1,outputPath:"fixture.wav"})).rejects.toThrow("403");
 expect(mocks.file).not.toHaveBeenCalled();expect(mocks.close).toHaveBeenCalledOnce();
});

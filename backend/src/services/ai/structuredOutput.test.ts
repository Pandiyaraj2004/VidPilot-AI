import {expect,it} from "vitest";
import {RESPONSE_SCHEMA} from "./geminiProvider.js";
import {VideoSceneSchema} from "./schema.js";
import {isFreeOpenRouterModel} from "./openRouterProvider.js";
it("prevents the keyword overflow seen in the real Gemini response",()=>{
 const scene={id:"1",order:0,narration:"The Moon reflects sunlight.",visualDescription:"Moon in the night sky",onScreenText:"Moonlight",estimatedDuration:3,visualKeywords:Array.from({length:7},(_,i)=>`moon ${i}`)};
 expect(VideoSceneSchema.safeParse(scene).success).toBe(false);
 expect(RESPONSE_SCHEMA.properties.scenes.items.properties.visualKeywords.maxItems).toBe(6);
 expect(VideoSceneSchema.safeParse({...scene,visualKeywords:scene.visualKeywords.slice(0,6)}).success).toBe(true);
});
it("never selects the previously configured paid fallback",()=>{expect(isFreeOpenRouterModel("openai/gpt-4o-mini")).toBe(false);expect(isFreeOpenRouterModel("openrouter/free")).toBe(true);expect(isFreeOpenRouterModel("provider/model:free")).toBe(true);});

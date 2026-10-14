import { expect, it } from "vitest";
import { selectNextVariation } from "./variationEngine.js";
import type { AutomationHistoryEntry } from "./automationHistory.js";

it("rotates language, matching voice, category, style and duration across consecutive videos", () => {
 const history: AutomationHistoryEntry[] = [];
 let previous: ReturnType<typeof selectNextVariation> | undefined;
 for(let i=0;i<20;i++) {
  const v=selectNextVariation(["science","space"],["ta","en"],[],history,30,35,"explainer");
  if(previous) {
   expect(v.language).not.toBe(previous.language);
   expect(v.voiceId).not.toBe(previous.voiceId);
   expect(v.category).not.toBe(previous.category);
   expect(v.style).not.toBe(previous.style);
   expect(v.durationSeconds).not.toBe(previous.durationSeconds);
  }
  expect(v.voiceId.startsWith(v.language)).toBe(true);
  expect(v.durationSeconds).toBeGreaterThanOrEqual(30);
  expect(v.durationSeconds).toBeLessThanOrEqual(35);
  history.unshift({timestamp:new Date().toISOString(),eventType:"job_created",language:v.language,voice:v.voiceId,category:v.category,style:v.style,targetDuration:v.durationSeconds,topic:v.topic});
  previous=v;
 }
});
it("respects a fixed duration and single enabled language/category",()=>{
 const v=selectNextVariation(["science"],["en"],["en_US-amy-medium"],[{timestamp:"",eventType:"job_created",targetDuration:30,style:"explainer"}],30,30,"explainer");
 expect(v).toMatchObject({language:"en",voiceId:"en_US-amy-medium",category:"science",durationSeconds:30,style:"documentary"});
});

import {expect,it} from "vitest";import {narrationFitsTarget} from "./durationPolicy.js";
it("uses measured audio duration with a bounded spoken pacing tolerance",()=>{expect(narrationFitsTarget(33,35)).toBe(true);expect(narrationFitsTarget(60,35)).toBe(false);expect(narrationFitsTarget(0,35)).toBe(false);expect(narrationFitsTarget(NaN,35)).toBe(false);});

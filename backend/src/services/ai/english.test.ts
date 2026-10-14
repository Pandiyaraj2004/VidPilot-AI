import {expect,it} from "vitest";
import {simpleEnglishIssues} from "./english.js";
it("accepts simple natural English",()=>{expect(simpleEnglishIssues("The moon does not make its own light. It reflects light from the sun. As it moves around Earth, we see different parts of its bright side.","en")).toEqual([]);});
it("requests repairs for formal English and long sentences",()=>{expect(simpleEnglishIssues("This extraordinary phenomenon exhibits unprecedented characteristics.","en").length).toBeGreaterThan(0);expect(simpleEnglishIssues(Array(28).fill("word").join(" "),"en").length).toBeGreaterThan(0);});
it("does not apply English style rules to Tamil or Hindi",()=>{expect(simpleEnglishIssues("unprecedented", "ta")).toEqual([]);expect(simpleEnglishIssues("utilize","hi")).toEqual([]);});

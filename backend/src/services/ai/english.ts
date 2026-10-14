export function simpleEnglishIssues(narration:string,language:string):string[] {
 if(language!=="en")return [];
 const errors:string[]=[];
 const sentences=narration.split(/[.!?]+/).filter(s=>s.trim());
 if(sentences.some(s=>s.trim().split(/\s+/).length>25)) errors.push("English narration has a sentence longer than 25 words. Split it into short sentences.");
 if(/\b(?:aforementioned|utilize|unprecedented|extraordinary phenomenon|possesses exceptional|delve|in conclusion)\b/i.test(narration)) errors.push("Use common everyday English words instead of formal or robotic phrases.");
 return errors;
}

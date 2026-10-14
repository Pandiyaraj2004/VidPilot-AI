/**
 * Turns a scene's AI-supplied visualKeywords (preferred) or a local
 * heuristic over visualDescription/narration (fallback, for old jobs or a
 * scene the AI didn't annotate) into an ordered query list, one rotated
 * per segment so multiple segments in one scene don't all search the exact
 * same phrase — see assetSearchEngine.ts, which calls this once per scene.
 */

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "of", "in", "on", "at", "to", "for",
  "with", "is", "are", "was", "were", "be", "been", "being", "this", "that",
  "these", "those", "it", "its", "as", "by", "from", "into", "about", "over",
  "after", "before", "than", "then", "so", "such", "very", "can", "could",
  "will", "would", "should", "may", "might", "has", "have", "had", "not",
  "you", "your", "we", "our", "they", "their", "there", "here", "which",
  "who", "what", "when", "where", "why", "how", "all", "some", "one", "two",
]);

function heuristicPhrase(text: string, maxWords = 4): string {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
  return words.slice(0, maxWords).join(" ");
}

/** Derives 1-3 fallback queries from visualDescription (preferred, already meant to be visual) then narration, when the AI didn't supply visualKeywords. */
function fallbackQueries(visualDescription: string, narration: string): string[] {
  const fromDescription = heuristicPhrase(visualDescription);
  const fromNarration = heuristicPhrase(narration);
  const queries = [fromDescription, fromNarration].filter((q) => q.length > 0);
  return queries.length > 0 ? Array.from(new Set(queries)) : ["abstract background"];
}

export interface QueryBuilderInput {
  visualKeywords?: string[];
  visualDescription: string;
  narration: string;
}
/** Camera commands and decorative skies are not subjects to illustrate. */
export function isSubjectQuery(query:string,narration:string):boolean{
 const q=query.toLowerCase().replace(/[_-]/g," ").trim();
 if(/^(push in|pull out|zoom in|zoom out|slow motion|wide shot|close up|tracking shot|aerial view|overhead|cinematic|dramatic lighting|golden hour)$/.test(q))return false;
 const atmosphere:Record<string,RegExp>={"dusk sky":/sky|dusk|night|space|moon/i,"storm clouds":/storm|cloud|weather/i,sunrise:/sun|dawn|morning/i,sunset:/sun|dusk|evening/i,"gentle waves":/wave|boat|river|ocean|sea/i,"city skyline":/city|skyline|urban/i};
 if(atmosphere[q]&&!atmosphere[q].test(narration))return false;
 return true;
}

/** Returns one query per segment index (queries rotate/cycle if fewer keywords than segments). */
export function buildSegmentQueries(input: QueryBuilderInput, segmentCount: number): string[] {
  const keywords = (input.visualKeywords ?? []).map((k) => k.trim()).filter(k=>Boolean(k)&&isSubjectQuery(k,input.narration));
  const pool = keywords.length > 0 ? keywords : fallbackQueries(input.visualDescription, input.narration);
  return Array.from({ length: segmentCount }, (_, i) => pool[i % pool.length]);
}

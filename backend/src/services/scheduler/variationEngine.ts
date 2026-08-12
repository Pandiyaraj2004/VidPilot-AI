import type { ContentCategory, VideoStyle } from "../../types/index.js";
import type { AutomationHistoryEntry } from "./automationHistory.js";
import { getVoicesForLanguage } from "../voice/voiceConfig.js";

// Standard rotation categories & topic ideas
const TOPICS: Record<ContentCategory, string[]> = {
  science: [
    "Why oil and water do not mix",
    "How quantum computers actually process data",
    "How gravity bends the flow of time",
    "Why diamonds are not as rare as you think",
    "The chemistry of spicy food and brain reaction",
  ],
  general_knowledge: [
    "Why bananas are technically berries but strawberries are not",
    "The history of the world's most expensive spice saffron",
    "Why salt was used as ancient money",
    "How traffic lights are timed to prevent gridlock",
    "The origin of the seven day week",
  ],
  technology: [
    "How fiber optic cables transmit internet across oceans",
    "Why your smartphone battery degrades over time",
    "The secret architecture of the microchip",
    "How touchscreens detect your fingerprint",
    "Why solid state drives are faster than hard disks",
  ],
  history: [
    "How the ancient library of Alexandria was lost",
    "The build of the ancient Roman concrete that survives today",
    "Why the ancient Vikings sailed to North America before Columbus",
    "The code of Hammurabi the oldest laws in history",
    "How paper making spread from ancient China to the West",
  ],
  mystery: [
    "The mystery of the sailing stones of death valley",
    "Why the Voynich manuscript remains undeciphered",
    "The secret of the Bermuda triangle gas hydrates theory",
    "Who built the Antikythera mechanism the first computer",
    "The mystery of the Oak Island money pit",
  ],
  motivation: [
    "How failure triggers neuroplasticity in the brain",
    "The power of micro habits five minutes daily",
    "Why discipline beats temporary motivation every time",
    "How the stoic concept of obstacle is the way works",
    "The secret of deep focus dopamine detox",
  ],
  facts: [
    "Honey never spoils even after thousands of years",
    "Wombat poop is cube shaped to mark territory",
    "Water makes a different sound depending on temperature",
    "Clouds can weigh more than a million pounds",
    "Trees communicate with each other through underground fungi",
  ],
  space: [
    "Why the moon is slowly moving away from Earth",
    "How long a day lasts on Venus compared to its year",
    "What the great red spot of Jupiter actually is",
    "Why space smells like hot metal and seared steak",
    "How the Voyager space probes still communicate with Earth",
  ],
  ai: [
    "How neural networks simulate human neurons",
    "The concept of artificial general intelligence",
    "Why training AI consumes vast amounts of energy",
    "How AI reconstructs blurred images using math",
    "The origin of the Turing test for machine intelligence",
  ],
  business: [
    "How loss leaders attract grocery store shoppers",
    "Why the cost of soda is mostly marketing",
    "How subscription models generate predictable revenue",
    "The economics of dynamic airline pricing",
    "Why companies file for bankruptcy protection",
  ],
  psychology: [
    "Why you remember negative events better than positive ones",
    "How the placebo effect changes body chemistry",
    "Why public speaking triggers the fight or flight response",
    "The psychology of color in retail marketing",
    "Why groupthink leads to poor decision making",
  ],
  story: [
    "The story of the marathon runner who took a shortcut",
    "How a single stamp saved the Panama canal project",
    "The builder who proved the Eiffel tower was safe",
    "How a fallen apple changed mathematical history",
    "The story of the longest running scientific experiment",
  ],
  news: [
    "How central banks adjust interest rates to manage inflation",
    "The global transition toward renewable energy grids",
    "How international shipping routes shape global trade",
    "Why supply chains are vulnerable to global choke points",
    "The math behind statistical sampling in public polling",
  ],
};

const STRUCTURES = [
  "hook_reveal",
  "story_conflict",
  "question_investigation",
  "problem_solution",
  "timeline",
  "myth_truth",
  "what_if",
  "mystery_clues",
  "before_after",
  "claim_counterpoint",
];

const HOOK_TYPES = ["unexpected_fact", "strong_question", "contradiction", "story_moment", "visual_mystery"];
const CTA_PATTERNS = ["topic_question", "comment_invite", "continuation", "none"];

export interface VariationSelection {
  topic: string;
  category: ContentCategory;
  style: VideoStyle;
  language: string;
  voiceId: string;
  durationSeconds: number;
  storyStructure: string;
  hookType: string;
  ctaPattern: string;
}

export function selectNextVariation(
  enabledCategories: ContentCategory[],
  enabledLanguages: string[],
  enabledVoices: string[],
  history: AutomationHistoryEntry[],
  minDuration: number,
  maxDuration: number,
  defaultStyle: VideoStyle
): VariationSelection {
  // 1. Pick Content Category
  const recentCategories = history.map((h) => h.category).filter(Boolean);
  const eligibleCategories = enabledCategories.length > 0 ? enabledCategories : ["science", "general_knowledge"];
  
  // Find least recently used category
  let chosenCategory = eligibleCategories[0] as ContentCategory;
  let maxUnusedCount = -1;
  for (const cat of eligibleCategories) {
    const lastIndex = recentCategories.indexOf(cat);
    const unusedCount = lastIndex === -1 ? 999 : lastIndex;
    if (unusedCount > maxUnusedCount) {
      maxUnusedCount = unusedCount;
      chosenCategory = cat as ContentCategory;
    }
  }

  // 2. Pick Topic
  const recentTopics = new Set(history.map((h) => h.topic?.toLowerCase()).filter(Boolean));
  const categoryTopics = TOPICS[chosenCategory as ContentCategory] || TOPICS.science;
  let chosenTopic = categoryTopics[0];
  for (const topic of categoryTopics) {
    if (!recentTopics.has(topic.toLowerCase())) {
      chosenTopic = topic;
      break;
    }
  }

  // 3. Language & Voice Rotation
  const eligibleLanguages = enabledLanguages.length > 0 ? enabledLanguages : ["en"];
  const recentLanguages = history.map((h) => h.language).filter(Boolean);
  
  let chosenLanguage = eligibleLanguages[0];
  let maxLangUnused = -1;
  for (const lang of eligibleLanguages) {
    const lastIndex = recentLanguages.indexOf(lang);
    const unusedCount = lastIndex === -1 ? 999 : lastIndex;
    if (unusedCount > maxLangUnused) {
      maxLangUnused = unusedCount;
      chosenLanguage = lang;
    }
  }

  // Pick voice matching language
  const languageVoices = getVoicesForLanguage(chosenLanguage).map((v) => v.id);
  const eligibleVoices = enabledVoices.filter((v) => languageVoices.includes(v));
  const finalVoicePool = eligibleVoices.length > 0 ? eligibleVoices : languageVoices;
  
  const recentVoices = history.map((h) => h.voice).filter(Boolean);
  let chosenVoice = finalVoicePool[0] || "en_US-amy-medium";
  let maxVoiceUnused = -1;
  for (const voice of finalVoicePool) {
    const lastIndex = recentVoices.indexOf(voice);
    const unusedCount = lastIndex === -1 ? 999 : lastIndex;
    if (unusedCount > maxVoiceUnused) {
      maxVoiceUnused = unusedCount;
      chosenVoice = voice;
    }
  }

  // 4. Select Story Structure
  const recentStructures = history.map((h) => h.storyStructure).filter(Boolean);
  let chosenStructure = STRUCTURES[0];
  let maxStructUnused = -1;
  for (const struct of STRUCTURES) {
    const lastIndex = recentStructures.indexOf(struct);
    const unusedCount = lastIndex === -1 ? 999 : lastIndex;
    if (unusedCount > maxStructUnused) {
      maxStructUnused = unusedCount;
      chosenStructure = struct;
    }
  }

  // 5. Select Hook Type
  const recentHooks = history.map((h) => h.hookType).filter(Boolean);
  let chosenHook = HOOK_TYPES[0];
  let maxHookUnused = -1;
  for (const hk of HOOK_TYPES) {
    const lastIndex = recentHooks.indexOf(hk);
    const unusedCount = lastIndex === -1 ? 999 : lastIndex;
    if (unusedCount > maxHookUnused) {
      maxHookUnused = unusedCount;
      chosenHook = hk;
    }
  }

  // 6. Select CTA Pattern
  const recentCTAs = history.map((h) => h.ctaPattern).filter(Boolean);
  let chosenCTA = CTA_PATTERNS[0];
  let maxCTAUnused = -1;
  for (const cta of CTA_PATTERNS) {
    const lastIndex = recentCTAs.indexOf(cta);
    const unusedCount = lastIndex === -1 ? 999 : lastIndex;
    if (unusedCount > maxCTAUnused) {
      maxCTAUnused = unusedCount;
      chosenCTA = cta;
    }
  }

  // 7. Select Target Duration (Randomly between min and max)
  const durationRange = maxDuration - minDuration;
  const chosenDuration = Math.round(minDuration + Math.random() * durationRange);

  return {
    topic: chosenTopic,
    category: chosenCategory,
    style: defaultStyle,
    language: chosenLanguage,
    voiceId: chosenVoice,
    durationSeconds: chosenDuration,
    storyStructure: chosenStructure,
    hookType: chosenHook,
    ctaPattern: chosenCTA,
  };
}

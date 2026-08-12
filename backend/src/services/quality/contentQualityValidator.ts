/**
 * Content ↔ visual relevance (Phase 9) — deliberately NOT a subjective "is
 * this video good" AI judgment (spec section 28 explicitly rules that
 * out). `LocalHeuristicProvider` is a real, explainable, deterministic
 * check: does the actual search query that found a scene's visual asset
 * share any meaningful word with what that scene's narration/AI-supplied
 * visualKeywords are actually about? Zero overlap across an entire scene
 * is a genuine, checkable signal worth a WARN — never a FAIL, since a
 * true semantic mismatch needs real judgment this heuristic doesn't have.
 *
 * `ContentQualityProvider` is a provider seam (matching the project's
 * existing VisualProvider/VoiceProvider pattern) for a future
 * AI-assisted evaluator — not built here. An external AI call is real
 * spend for a nice-to-have double-check the deterministic heuristic
 * already covers reasonably; not "genuinely necessary" for this phase.
 */

import type { QualityCheckResult, QualityIssue, VideoScene } from "../../types/index.js";

export interface ContentQualityProvider {
  evaluateScene(scene: VideoScene): QualityIssue[];
}

const STOPWORDS = new Set([
  "the", "a", "an", "of", "in", "on", "at", "to", "for", "and", "or", "is", "are", "was", "were",
  "with", "by", "from", "as", "its", "it", "this", "that", "your", "you", "how", "what", "why",
]);

function meaningfulWords(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
  return new Set(words);
}

export class LocalHeuristicProvider implements ContentQualityProvider {
  evaluateScene(scene: VideoScene): QualityIssue[] {
    const assets = scene.visual?.assets ?? [];
    const realAssets = assets.filter((a) => a.provider !== "procedural");
    if (realAssets.length === 0) return []; // procedural background — nothing to compare against a search query

    const referenceText = [scene.narration, scene.visualDescription, ...(scene.visualKeywords ?? [])].join(" ");
    const referenceWords = meaningfulWords(referenceText);
    if (referenceWords.size === 0) return [];

    const issues: QualityIssue[] = [];
    for (const asset of realAssets) {
      const queryWords = meaningfulWords(asset.query);
      const overlap = [...queryWords].some((w) => referenceWords.has(w));
      if (queryWords.size > 0 && !overlap) {
        issues.push({
          severity: "warn",
          sceneId: scene.id,
          message: `Visual search query "${asset.query}" shares no words with this scene's narration/keywords — possible visual relevance mismatch.`,
        });
      }
    }
    return issues;
  }
}

export function validateContentQuality(scenes: VideoScene[], provider: ContentQualityProvider = new LocalHeuristicProvider()): QualityCheckResult {
  const issues: QualityIssue[] = [];
  for (const scene of scenes) {
    issues.push(...provider.evaluateScene(scene));
  }

  const status: QualityCheckResult["status"] = issues.length > 0 ? "WARN" : "PASS";

  return {
    status,
    details: { scenesChecked: scenes.length },
    issues,
  };
}

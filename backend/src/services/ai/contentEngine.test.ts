import { describe, expect, it } from "vitest";
import { AIGenerationError, generateVideoContent } from "./contentEngine.js";
import { ProviderError, type AIProvider, type ProviderGenerateResult } from "./aiProvider.js";
import type { GenerationContext } from "./prompts.js";

const VALID_JSON = JSON.stringify({
  title: "How Black Holes Work",
  hook: "What happens if you fall into a black hole?",
  introduction: "Black holes are among the most extreme objects in the universe.",
  scenes: [
    {
      id: "scene-1",
      order: 0,
      narration: "A black hole forms when a massive star collapses under its own gravity.",
      visualDescription: "A dying star collapsing inward into a bright point of light.",
      onScreenText: "Stellar Collapse",
      estimatedDuration: 60,
    },
  ],
  conclusion: "Black holes remain one of the great mysteries of physics.",
  description: "An explainer on how black holes form and behave.",
  tags: ["space", "physics"],
  estimatedDuration: 60,
});

const CTX: GenerationContext = {
  topic: "How do black holes work?",
  inputScript: null,
  style: "explainer",
  contentCategory: "science",
  durationSeconds: 60,
  language: "en",
  visualStyle: "automatic",
};

class ScriptedProvider implements AIProvider {
  readonly name: "gemini" | "openrouter";
  private callCount = 0;

  constructor(
    name: "gemini" | "openrouter",
    private readonly script: (() => ProviderGenerateResult | never)[]
  ) {
    this.name = name;
  }

  async generate(): Promise<ProviderGenerateResult> {
    const step = this.script[Math.min(this.callCount, this.script.length - 1)];
    this.callCount += 1;
    return step();
  }

  get calls() {
    return this.callCount;
  }
}

function succeed(model = "test-model"): ProviderGenerateResult {
  return { rawText: VALID_JSON, model };
}

function fail(name: "gemini" | "openrouter"): never {
  throw new ProviderError(name, "unavailable", `${name} is temporarily unavailable.`);
}

describe("generateVideoContent", () => {
  it("returns Gemini's result on first-attempt success", async () => {
    const gemini = new ScriptedProvider("gemini", [succeed]);
    const openrouter = new ScriptedProvider("openrouter", [succeed]);

    const result = await generateVideoContent(CTX, [gemini, openrouter]);

    expect(result.provider).toBe("gemini");
    expect(gemini.calls).toBe(1);
    expect(openrouter.calls).toBe(0);
  });

  it("falls back to OpenRouter after Gemini fails twice", async () => {
    const gemini = new ScriptedProvider("gemini", [() => fail("gemini"), () => fail("gemini")]);
    const openrouter = new ScriptedProvider("openrouter", [succeed]);

    const result = await generateVideoContent(CTX, [gemini, openrouter]);

    expect(result.provider).toBe("openrouter");
    expect(gemini.calls).toBe(2);
    expect(openrouter.calls).toBe(1);
  });

  it("throws AIGenerationError when every provider fails", async () => {
    const gemini = new ScriptedProvider("gemini", [() => fail("gemini")]);
    const openrouter = new ScriptedProvider("openrouter", [() => fail("openrouter")]);

    await expect(generateVideoContent(CTX, [gemini, openrouter])).rejects.toThrow(AIGenerationError);
  });

  it("moves to the fallback immediately on an auth error, without wasting a retry", async () => {
    const gemini = new ScriptedProvider("gemini", [
      () => {
        throw new ProviderError("gemini", "auth", "invalid API key");
      },
    ]);
    const openrouter = new ScriptedProvider("openrouter", [succeed]);

    const result = await generateVideoContent(CTX, [gemini, openrouter]);

    expect(result.provider).toBe("openrouter");
    expect(gemini.calls).toBe(1);
  });

  it("retries with repair feedback when the response fails validation, then succeeds", async () => {
    const gemini = new ScriptedProvider("gemini", [() => ({ rawText: "not json at all", model: "test" }), succeed]);

    const result = await generateVideoContent(CTX, [gemini]);

    expect(result.provider).toBe("gemini");
    expect(gemini.calls).toBe(2);
  });
});

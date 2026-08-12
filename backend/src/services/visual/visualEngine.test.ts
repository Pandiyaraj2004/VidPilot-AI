import { describe, expect, it } from "vitest";
import type { VideoScene } from "../../types/index.js";
import { runVisualGeneration, type VisualEngineOptions } from "./visualEngine.js";
import { VisualProviderError, type VisualInput, type VisualProvider, type VisualResult } from "./visualProvider.js";

function makeScene(overrides: Partial<VideoScene> = {}): VideoScene {
  return {
    id: `scene-${overrides.order ?? 0}`,
    order: 0,
    narration: "A narration line.",
    visualDescription: "A visual.",
    onScreenText: "Caption",
    estimatedDuration: 10,
    ...overrides,
  };
}

class FakeVisualProvider implements VisualProvider {
  readonly name = "fake";
  calls: VisualInput[] = [];

  constructor(private readonly script: (() => VisualResult)[]) {}

  async generateVisual(input: VisualInput): Promise<VisualResult> {
    this.calls.push(input);
    const step = this.script[Math.min(this.calls.length - 1, this.script.length - 1)];
    return step();
  }
}

function succeed(): VisualResult {
  return { template: "documentary", backgroundKind: "gradient", colors: ["#111", "#222"], accentColor: "#fff" };
}

function fail(kind: "invalid_input" | "generation_failed" = "generation_failed"): never {
  throw new VisualProviderError(kind, `Simulated ${kind} failure.`);
}

const BASE: Omit<VisualEngineOptions, "scenes"> = {
  jobId: "job-1",
  jobStyle: "documentary",
  visualStyleSetting: "automatic",
  language: "en",
};

describe("runVisualGeneration", () => {
  it("generates a visual for every pending scene", async () => {
    const provider = new FakeVisualProvider([succeed]);
    const scenes = [makeScene({ order: 0 }), makeScene({ order: 1, id: "scene-1" })];

    const result = await runVisualGeneration({ ...BASE, scenes }, provider);

    expect(result.allReady).toBe(true);
    expect(result.scenes.every((s) => s.visual?.status === "ready")).toBe(true);
    expect(provider.calls).toHaveLength(2);
  });

  it("skips scenes that already have a ready visual unless forced", async () => {
    const readyScene = makeScene({ visual: { status: "ready", template: "facts" } });
    const provider = new FakeVisualProvider([succeed]);

    const result = await runVisualGeneration({ ...BASE, scenes: [readyScene] }, provider);

    expect(provider.calls).toHaveLength(0);
    expect(result.scenes[0].visual?.template).toBe("facts");
  });

  it("retries a transient failure and succeeds on the second attempt", async () => {
    const provider = new FakeVisualProvider([() => fail("generation_failed"), succeed]);
    const result = await runVisualGeneration({ ...BASE, scenes: [makeScene()] }, provider);

    expect(provider.calls).toHaveLength(2);
    expect(result.allReady).toBe(true);
  });

  it("does not retry a non-retryable failure kind", async () => {
    const provider = new FakeVisualProvider([() => fail("invalid_input")]);
    const result = await runVisualGeneration({ ...BASE, scenes: [makeScene()] }, provider);

    expect(provider.calls).toHaveLength(1);
    expect(result.allReady).toBe(false);
  });

  it("reports partial failure without discarding other scenes' visuals", async () => {
    let call = 0;
    const provider: VisualProvider = {
      name: "fake",
      async generateVisual() {
        call += 1;
        if (call === 2) throw new VisualProviderError("invalid_input", "scene 2 fails");
        return succeed();
      },
    };
    const scenes = [makeScene({ order: 0 }), makeScene({ order: 1, id: "scene-1" }), makeScene({ order: 2, id: "scene-2" })];

    const result = await runVisualGeneration({ ...BASE, scenes }, provider);

    expect(result.allReady).toBe(false);
    expect(result.failedSceneIds).toEqual(["scene-1"]);
    expect(result.scenes[0].visual?.status).toBe("ready");
    expect(result.scenes[1].visual?.status).toBe("failed");
    expect(result.scenes[2].visual?.status).toBe("ready");
  });
});

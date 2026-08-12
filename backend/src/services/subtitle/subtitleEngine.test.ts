import { describe, expect, it } from "vitest";
import type { VideoScene } from "../../types/index.js";
import { runSubtitleGeneration } from "./subtitleEngine.js";

function makeScene(overrides: Partial<VideoScene> = {}): VideoScene {
  return {
    id: "scene-0",
    order: 0,
    narration: "This is a narration sentence. It has two sentences.",
    visualDescription: "A visual.",
    onScreenText: "Caption",
    estimatedDuration: 10,
    audio: { status: "ready", duration: 6, format: "wav", provider: "piper" },
    ...overrides,
  };
}

describe("runSubtitleGeneration", () => {
  it("generates subtitle cues for a scene with ready audio", () => {
    const result = runSubtitleGeneration({ scenes: [makeScene()] });

    expect(result.allReady).toBe(true);
    expect(result.scenes[0].subtitles).toHaveLength(2);
    expect(result.scenes[0].subtitles?.[1].endSeconds).toBe(6);
  });

  it("fails a scene whose audio is not ready, without throwing", () => {
    const scene = makeScene({ audio: { status: "pending" } });
    const result = runSubtitleGeneration({ scenes: [scene] });

    expect(result.allReady).toBe(false);
    expect(result.failedSceneIds).toEqual(["scene-0"]);
    expect(result.scenes[0].subtitles).toBeUndefined();
  });

  it("skips scenes that already have subtitles unless forced", () => {
    const readyScene = makeScene({ subtitles: [{ index: 0, text: "existing", startSeconds: 0, endSeconds: 1 }] });
    const result = runSubtitleGeneration({ scenes: [readyScene] });

    expect(result.scenes[0].subtitles).toHaveLength(1);
    expect(result.scenes[0].subtitles?.[0].text).toBe("existing");
  });

  it("regenerates subtitles for an already-processed scene when forced", () => {
    const readyScene = makeScene({ subtitles: [{ index: 0, text: "existing", startSeconds: 0, endSeconds: 1 }] });
    const result = runSubtitleGeneration({ scenes: [readyScene], force: true });

    expect(result.scenes[0].subtitles?.[0].text).not.toBe("existing");
  });

  it("only processes the targeted scene when targetSceneId is set", () => {
    const scenes = [makeScene({ id: "scene-0", order: 0 }), makeScene({ id: "scene-1", order: 1 })];
    const result = runSubtitleGeneration({ scenes, targetSceneId: "scene-1" });

    expect(result.scenes[0].subtitles).toBeUndefined();
    expect(result.scenes[1].subtitles).toBeDefined();
  });

  it("keeps real Tamil narration intact across the generated cues", () => {
    const tamil = makeScene({
      narration: "தமிழ்நாடு இந்தியாவின் ஒரு தென் மாநிலம். இதன் தலைநகரம் சென்னை.",
      audio: { status: "ready", duration: 8, format: "wav", provider: "edge-tts" },
    });
    const result = runSubtitleGeneration({ scenes: [tamil] });

    expect(result.allReady).toBe(true);
    const joined = result.scenes[0].subtitles?.map((c) => c.text).join(" ");
    expect(joined).toContain("தமிழ்நாடு");
    expect(joined).toContain("சென்னை");
  });
});

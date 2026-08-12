import { describe, expect, it } from "vitest";
import { parseAndValidateContent } from "./schema.js";

const VALID_CONTENT = {
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
      estimatedDuration: 12,
    },
  ],
  conclusion: "Black holes remain one of the great mysteries of physics.",
  description: "An explainer on how black holes form and behave.",
  tags: ["space", "physics", "black holes"],
  estimatedDuration: 12,
};

describe("parseAndValidateContent", () => {
  it("accepts valid JSON matching the schema", () => {
    const result = parseAndValidateContent(JSON.stringify(VALID_CONTENT));
    expect(result.ok).toBe(true);
    expect(result.value?.title).toBe("How Black Holes Work");
  });

  it("strips a markdown code fence before parsing", () => {
    const fenced = "```json\n" + JSON.stringify(VALID_CONTENT) + "\n```";
    const result = parseAndValidateContent(fenced);
    expect(result.ok).toBe(true);
  });

  it("rejects invalid JSON", () => {
    const result = parseAndValidateContent("{ this is not json");
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatch(/not valid JSON/);
  });

  it("rejects content missing a title", () => {
    const { title, ...rest } = VALID_CONTENT;
    const result = parseAndValidateContent(JSON.stringify(rest));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("title"))).toBe(true);
  });

  it("rejects content with no scenes", () => {
    const result = parseAndValidateContent(JSON.stringify({ ...VALID_CONTENT, scenes: [] }));
    expect(result.ok).toBe(false);
  });

  it("rejects a scene missing a visual description", () => {
    const broken = {
      ...VALID_CONTENT,
      scenes: [{ ...VALID_CONTENT.scenes[0], visualDescription: undefined }],
    };
    const result = parseAndValidateContent(JSON.stringify(broken));
    expect(result.ok).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import { buildSegmentQueries } from "./visualQueryBuilder.js";

describe("buildSegmentQueries", () => {
  it("uses AI-supplied visualKeywords verbatim when present", () => {
    const queries = buildSegmentQueries(
      { visualKeywords: ["human brain", "neurons firing"], visualDescription: "a description", narration: "narration" },
      2
    );
    expect(queries).toEqual(["human brain", "neurons firing"]);
  });

  it("cycles keywords when there are more segments than keywords", () => {
    const queries = buildSegmentQueries(
      { visualKeywords: ["octopus underwater"], visualDescription: "d", narration: "n" },
      3
    );
    expect(queries).toEqual(["octopus underwater", "octopus underwater", "octopus underwater"]);
  });

  it("falls back to a heuristic derived from visualDescription when visualKeywords is absent", () => {
    const queries = buildSegmentQueries(
      { visualDescription: "Aerial view of a city skyline at night", narration: "The city never sleeps." },
      1
    );
    expect(queries[0].length).toBeGreaterThan(0);
    expect(queries[0]).not.toBe("");
  });

  it("falls back to narration when visualDescription has no usable words", () => {
    const queries = buildSegmentQueries({ visualDescription: "the a an", narration: "Octopuses have three hearts." }, 1);
    expect(queries[0]).toContain("octopuses");
  });

  it("never returns an empty string, even for entirely stopword input", () => {
    const queries = buildSegmentQueries({ visualDescription: "the a an", narration: "the a an" }, 1);
    expect(queries[0].trim().length).toBeGreaterThan(0);
  });

  it("strips punctuation and lowercases the heuristic fallback", () => {
    const queries = buildSegmentQueries({ visualDescription: "The Eiffel Tower!", narration: "n" }, 1);
    expect(queries[0]).toBe("eiffel tower");
  });
});

import { describe, expect, it } from "vitest";
import { VALID_CONTENT_CATEGORIES } from "../audio/contentCategory.js";
import { mapContentCategoryToYoutubeCategoryId, YOUTUBE_CATEGORY_MAP } from "./youtubeCategoryMap.js";

describe("YOUTUBE_CATEGORY_MAP", () => {
  it("maps every real content category to a real numeric YouTube category id", () => {
    for (const category of VALID_CONTENT_CATEGORIES) {
      const id = mapContentCategoryToYoutubeCategoryId(category);
      expect(id).toMatch(/^\d+$/);
    }
  });

  it("never invents a category id — the map has no entries beyond the real ContentCategory set", () => {
    expect(Object.keys(YOUTUBE_CATEGORY_MAP).sort()).toEqual([...VALID_CONTENT_CATEGORIES].sort());
  });

  it("maps technology/ai/science/space to Science & Technology (28)", () => {
    expect(mapContentCategoryToYoutubeCategoryId("technology")).toBe("28");
    expect(mapContentCategoryToYoutubeCategoryId("ai")).toBe("28");
    expect(mapContentCategoryToYoutubeCategoryId("science")).toBe("28");
    expect(mapContentCategoryToYoutubeCategoryId("space")).toBe("28");
  });

  it("maps general_knowledge/facts/history to Education (27)", () => {
    expect(mapContentCategoryToYoutubeCategoryId("general_knowledge")).toBe("27");
    expect(mapContentCategoryToYoutubeCategoryId("facts")).toBe("27");
    expect(mapContentCategoryToYoutubeCategoryId("history")).toBe("27");
  });

  it("maps news to News & Politics (25)", () => {
    expect(mapContentCategoryToYoutubeCategoryId("news")).toBe("25");
  });
});

import { describe, it, expect } from "vitest";
import {
  CONTENT_CATEGORY_LABELS,
  CONTENT_CATEGORY_MUSIC_FOLDER,
  VALID_CONTENT_CATEGORIES,
  musicFolderForCategory,
} from "./contentCategory.js";

const VALID_MUSIC_FOLDERS = new Set(["motivation", "curiosity", "mystery", "technology", "emotional", "energetic", "general"]);

describe("content category → music folder mapping", () => {
  it("every valid category maps to one of the 7 real music folders", () => {
    for (const category of VALID_CONTENT_CATEGORIES) {
      const folder = musicFolderForCategory(category);
      expect(VALID_MUSIC_FOLDERS.has(folder)).toBe(true);
    }
  });

  it("has a label for every valid category", () => {
    for (const category of VALID_CONTENT_CATEGORIES) {
      expect(CONTENT_CATEGORY_LABELS[category]).toBeTruthy();
    }
  });

  it("has a mapping entry for every valid category (no silent fallback to undefined)", () => {
    for (const category of VALID_CONTENT_CATEGORIES) {
      expect(CONTENT_CATEGORY_MUSIC_FOLDER[category]).toBeDefined();
    }
  });

  it("maps motivation and mystery to their own like-named folders", () => {
    expect(musicFolderForCategory("motivation")).toBe("motivation");
    expect(musicFolderForCategory("mystery")).toBe("mystery");
  });

  it("maps AI and technology to the same folder", () => {
    expect(musicFolderForCategory("ai")).toBe(musicFolderForCategory("technology"));
  });
});
